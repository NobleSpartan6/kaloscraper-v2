import streamlit as st
import plotly.express as px
from analysis import preprocess_scripts, identify_patterns, rank_videos
import os
import pandas as pd
from groq import Groq

def create_dashboard():
    st.title("TikTok Script Analysis Dashboard")

    client = Groq(
    api_key = st.secrets["GROQ_API_KEY"]
    )

    # User Guide
    st.sidebar.header("User Guide")
    st.sidebar.write("""
    1. **Top Performing Videos**: Displays a table of the top-performing videos based on various metrics.
    2. **Common Phrases by Category**: Shows bar charts of the most common phrases found in the scripts, categorized by type.
    3. **Common Words**: Shows a bar chart of the most common words found in the scripts.
    4. **Performance Metrics**: Allows you to select a metric and view its relationship with the video score in a scatter plot.
    """)

    # Explanation of Ranking System
    st.sidebar.header("Ranking System Explanation")
    st.sidebar.write("""
    The ranking system scores videos based on the following normalized metrics:
    - **Items Sold**: 30%
    - **Revenue**: 30%
    - **Views**: 20%
    - **GPM (Gross Profit Margin)**: 20%
    The scores are calculated and the videos are ranked from highest to lowest score.
    """)

    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'scripts')
    df = preprocess_scripts(scripts_dir)
    df = rank_videos(df)
    categorized_phrases, top_words, ai_analysis, uncategorized_phrases = identify_patterns(df)

    st.header("Top Performing Videos")
    df_display = df[['rank', 'title', 'items_sold', 'revenue', 'views', 'gpm', 'score']].rename(columns={
        'rank': 'Rank',
        'title': 'Title',
        'items_sold': 'Items Sold',
        'revenue': 'Revenue ($)',
        'views': 'Views',
        'gpm': 'GPM($)',
        'score': 'Score'
    })
    st.dataframe(df_display)

    st.header("Common Phrases by Category")
    for category, phrases in categorized_phrases.items():
        if phrases:
            fig_phrases = px.bar(
                x=[phrase for phrase, _ in phrases[:10]],
                y=[score for _, score in phrases[:10]],
                title=f"Top Phrases in {category.capitalize()}"
            )
            st.plotly_chart(fig_phrases)
        else:
            st.write(f"No common phrases found for {category}")

    st.header("Common Words")
    fig_words = px.bar(x=[word for word, _ in top_words], y=[count for _, count in top_words])
    st.plotly_chart(fig_words)

    # st.header("Uncategorized Top Phrases")
    # st.write(", ".join(uncategorized_phrases[:20]))

    # st.header("AI Analysis of Patterns")
    # st.write(ai_analysis)

    st.header("Performance Metrics")
    metric = st.selectbox("Select Metric", ['items_sold', 'revenue', 'views', 'gpm'])
    fig_metric = px.scatter(df, x='score', y=metric, hover_data=['title'])
    st.plotly_chart(fig_metric)

    # New section for script generation
    st.header("Generate TikTok Script")
    st.write("The script will be generated based on the top phrases and words found in top performing scripts. Powered by Llama 3.1")
    prompt = st.text_area("Enter a topic or product for the TikTok script:")
    
    if st.button("Generate Script"):
        if prompt:
            try:
                # Prepare the context with categorized phrases and top words
                context = "Categorized phrases:\n"
                for category, phrases in categorized_phrases.items():
                    context += f"{category.capitalize()}: {', '.join([phrase for phrase, _ in phrases[:50]])}\n"
                context += f"\nTop words: {', '.join([word for word, _ in top_words[:50]])}\n"
                
                messages = [
                    {"role": "system", "content": "You are an AI assistant that generates TikTok scripts for UGC creators based on successful patterns. TikTok user-generated content (UGC) features products from a specific brand but is created by users instead of brands Only use the phrases and words provided in the context if its relevant to the prompt. If any words or phrases provided in context are not relevant to the prompt DO NOT include it when generating a script"},
                    {"role": "user", "content": f"Categorized phrases and words:\n{context}\nGenerate a TikTok UGC script about: {prompt}"}
                ]
                print(messages)
                
                chat_completion = client.chat.completions.create(
                    model="llama-3.1-70b-versatile",
                    messages=messages,
                    max_tokens=800,
                    temperature=0.8
                )
                
                generated_script = chat_completion.choices[0].message.content
                st.text_area("Generated Script:", value=generated_script, height=300)
            except Exception as e:
                st.error(f"An error occurred: {str(e)}")
        else:
            st.warning("Please enter a topic or product for the script.")

    # Export button
    if st.button("Export Common Words and Phrases"):
        export_data = {
            "categorized_phrases": {category: [phrase for phrase, _ in phrases] for category, phrases in categorized_phrases.items()},
            "top_words": [word for word, _ in top_words]
        }
        export_df = pd.DataFrame(export_data)
        export_df.to_csv("common_words_phrases.csv", index=False)
        st.success("Common words and phrases exported successfully!")

if __name__ == "__main__":
    create_dashboard()