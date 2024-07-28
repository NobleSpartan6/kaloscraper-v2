import os
import pandas as pd
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from groq import Groq
import logging
import streamlit as st

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)

def preprocess_scripts(scripts_dir):
    logging.info(f"Processing scripts from directory: {scripts_dir}")
    data = []
    
    for file in os.listdir(scripts_dir):
        if file.endswith('.txt'):
            file_path = os.path.join(scripts_dir, file)
            logging.info(f"Processing file: {file}")
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()[1:]  # Skip the first line
                    content = ''.join(lines)
                
                print(f"Content of {file}:\n{content}\n")
                
                video_info = {}
                script_text = ""
                
                # Split content into Video Information and Script sections
                sections = content.split('\n\n')
                for section in sections:
                    if section.startswith('Video Information:'):
                        for line in section.split('\n')[1:]:
                            if ':' in line:
                                key, value = line.split(':', 1)
                                video_info[key.strip()] = value.strip()
                        print(f"Parsed video_info for {file}: {video_info}")
                    elif section.startswith('Script:'):
                        script_lines = section.split('\n')[1:]
                        script_text = ' '.join([line.strip() for line in script_lines if not line.strip().isdigit() and '-->' not in line])
                        print(f"Parsed script_text for {file}: {script_text}")
                
                # If script_text is empty, use the title
                if not script_text.strip():
                    script_text = video_info.get('Title', '')
                
                # Tokenize and clean the script text
                tokens = word_tokenize(script_text.lower())
                tokens = [word for word in tokens if word.isalnum() and word not in stopwords.words('english')]
                
                data.append({
                    'title': video_info.get('Title', 'N/A'),
                    'items_sold': video_info.get('Items Sold', 'N/A'),
                    'revenue': video_info.get('Revenue', 'N/A'),
                    'views': video_info.get('Views', 'N/A'),
                    'gpm': video_info.get('GPM', 'N/A'),
                    'ad_cpa': video_info.get('Ad CPA', 'N/A'),
                    'tokens': tokens
                })
                logging.info(f"Successfully processed {file}")
                print(f"Successfully processed {file}")
                print(data[-1])
            except Exception as e:
                logging.error(f"Error processing {file}: {str(e)}")
                print(f"Error processing {file}: {str(e)}")
    
    df = pd.DataFrame(data)
    logging.info(f"Created DataFrame with shape: {df.shape}")
    print(df)
    return df

def identify_patterns(df):
    logging.info("Identifying patterns in the data")
    phrases = [' '.join(tokens) for tokens in df['tokens']]
    
    # Define categories for phrases
    categories = {
        'scarcity': ['selling', 'limited', 'almost', 'last', 'hurry', 'running', 'exclusive', 'only'],
        'value_proposition': ['best', 'save', 'worth', 'must', 'great', 'affordable', 'quality', 'bargain'],
        'call_to_action': ['buy', 'check', 'miss', 'swipe', 'click', 'shop', 'get', 'order'],
        'product_description': ['amazing', 'comfortable', 'game', 'life', 'perfect', 'versatile', 'durable', 'innovative'],
        'social_proof': ['everyone', 'trending', 'viral', 'favorite', 'best-seller', 'rated', 'popular', 'recommended']
    }
    
    vectorizer = TfidfVectorizer(ngram_range=(1, 3))
    tfidf_matrix = vectorizer.fit_transform(phrases)
    feature_names = vectorizer.get_feature_names_out()
    
    # Categorize top phrases
    categorized_phrases = {category: [] for category in categories}
    top_phrases = sorted(zip(feature_names, tfidf_matrix.sum(axis=0).A1), key=lambda x: x[1], reverse=True)[:200]
    
    for phrase, score in top_phrases:
        for category, keywords in categories.items():
            if any(keyword in phrase.lower() for keyword in keywords):
                categorized_phrases[category].append((phrase, score))
                break
    
    # Get top words
    all_words = [word for tokens in df['tokens'] for word in tokens]
    word_freq = Counter(all_words)
    top_words = word_freq.most_common(50)
    
    # Identify uncategorized phrases
    uncategorized_phrases = [phrase for phrase, _ in top_phrases if not any(phrase in cat_phrases for cat_phrases in categorized_phrases.values())]
    print("Top uncategorized phrases:", uncategorized_phrases[:20])
    
    # Use Groq API for additional analysis
    client = Groq(api_key = st.secrets["GROQ_API_KEY"])
    
    prompt = f"""
    Analyze the following categorized phrases and top words from TikTok UGC scripts:
    
    Categorized phrases:
    {', '.join([f"{category}: {', '.join([phrase for phrase, _ in phrases[:5]])}" for category, phrases in categorized_phrases.items()])}
    
    Top words: {', '.join([word for word, _ in top_words[:50]])}
    
    Uncategorized top phrases: {', '.join(uncategorized_phrases[:20])}
    
    Provide insights on:
    1. How well the predefined categories capture the common themes in the scripts
    2. Suggestions for additional categories based on the uncategorized phrases
    3. Effective language patterns observed in each category
    4. Recommendations for creating engaging UGC content using these patterns
    """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an AI assistant that analyzes TikTok UGC script patterns."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.7
        )
        ai_analysis = response.choices[0].message.content
    except Exception as e:
        logging.error(f"Error using Groq API: {str(e)}")
        ai_analysis = "AI analysis unavailable due to an error."
    
    return categorized_phrases, top_words, ai_analysis, uncategorized_phrases

def rank_videos(df):
    logging.info("Ranking videos")
    
    def convert_to_numeric(value):
        if isinstance(value, str):
            value = value.replace('$', '').replace(',', '')
            if value.endswith('k'):
                return float(value[:-1]) * 1000
            elif value.endswith('m'):
                return float(value[:-1]) * 1000000
        return pd.to_numeric(value, errors='coerce')
    
    for col in ['items_sold', 'revenue', 'views', 'gpm']:
        df[col] = df[col].apply(convert_to_numeric)
    
    for col in ['items_sold', 'revenue', 'views', 'gpm']:
        if df[col].notna().any():
            df[f'{col}_normalized'] = (df[col] - df[col].min()) / (df[col].max() - df[col].min())
        else:
            df[f'{col}_normalized'] = 0
    
    df['score'] = (
        df['items_sold_normalized'] * 0.3 +
        df['revenue_normalized'] * 0.3 +
        df['views_normalized'] * 0.2 +
        df['gpm_normalized'] * 0.2
    )
    
    df = df.sort_values('score', ascending=False).reset_index(drop=True)
    df['rank'] = df.index + 1
    
    return df

if __name__ == "__main__":
    scripts_dir = "../scripts"
    df = preprocess_scripts(scripts_dir)
    df = rank_videos(df)
    categorized_phrases, top_words, ai_analysis, uncategorized_phrases = identify_patterns(df)
    
    print(df.head())
    print("\nCategorized phrases:")
    for category, phrases in categorized_phrases.items():
        print(f"{category.capitalize()}: {', '.join([phrase for phrase, _ in phrases[:10]])}")
    print(f"\nTop words: {', '.join([word for word, _ in top_words[:50]])}")
    print("\nTop uncategorized phrases:", ', '.join(uncategorized_phrases[:20]))
    print("\nAI Analysis:")
    print(ai_analysis)