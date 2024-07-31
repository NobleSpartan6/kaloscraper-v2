import streamlit as st
import plotly.express as px
from analysis import preprocess_scripts, identify_patterns, rank_videos
import os
import pandas as pd
from groq import Groq
import json

def create_dashboard():
    st.set_page_config(layout="wide")
    st.title("TikTok Script Analysis & Generation Dashboard")

    client = Groq(
    api_key = st.secrets["GROQ_API_KEY"]
    )

    # User Guide
    with st.expander("User Guide"):
        st.write("""
        1. **Top Performing Videos**: Displays a table of the top-performing videos based on various metrics.
        2. **Common Phrases by Category**: Shows bar charts of the most common phrases found in the scripts, categorized by type.
        3. **Common Words**: Shows a bar chart of the most common words found in the scripts.
        4. **Performance Metrics**: Allows you to select a metric and view its relationship with the video score in a scatter plot.
        5. **Script Generation**: Generate a TikTok script based on top-performing patterns and AI analysis.
        """)

    # Explanation of Ranking System
    with st.expander("Ranking System Explanation"):
        st.write("""
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

    show_dashboard(df, categorized_phrases, top_words, ai_analysis, uncategorized_phrases, client)

def show_dashboard(df, categorized_phrases, top_words, ai_analysis, uncategorized_phrases, client):
    st.header("Video Performance Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Top Performing Videos")
        df_display = df[['rank', 'title', 'items_sold', 'revenue', 'views', 'gpm', 'score']].rename(columns={
            'rank': 'Rank', 'title': 'Title', 'items_sold': 'Items Sold',
            'revenue': 'Revenue ($)', 'views': 'Views', 'gpm': 'GPM($)', 'score': 'Score'
        })
        st.dataframe(df_display)

    with col2:
        st.subheader("Performance Metrics")
        metric = st.selectbox("Select Metric", ['items_sold', 'revenue', 'views', 'gpm'])
        fig_metric = px.scatter(df, x='score', y=metric, hover_data=['title'])
        st.plotly_chart(fig_metric, use_container_width=True)

    st.header("Language Pattern Analysis")
    
    col3, col4 = st.columns(2)
    
    with col3:
        st.subheader("Common Phrases by Category")
        category = st.selectbox("Select Category", list(categorized_phrases.keys()))
        if categorized_phrases[category]:
            fig_phrases = px.bar(
                y=[phrase for phrase, _ in categorized_phrases[category][:10]],
                x=[score for _, score in categorized_phrases[category][:10]],
                title=f"Top Phrases in {category.capitalize()}",
                orientation='h'
            )
            fig_phrases.update_layout(yaxis={'categoryorder':'total ascending'})
            st.plotly_chart(fig_phrases, use_container_width=True)
        else:
            st.write(f"No common phrases found for {category}")

    with col4:
        st.subheader("Common Words")
        fig_words = px.bar(
            y=[word for word, _ in top_words[:20]],
            x=[count for _, count in top_words[:20]],
            orientation='h'
        )
        fig_words.update_layout(yaxis={'categoryorder':'total ascending'})
        st.plotly_chart(fig_words, use_container_width=True)

    with st.expander("Uncategorized Top Phrases"):
        st.write(", ".join(uncategorized_phrases[:20]))

    with st.expander("AI Analysis of Patterns"):
        st.write(ai_analysis)

    st.header("Generate TikTok Script")
    st.write("Generate a script based on top-performing patterns and AI analysis powered by Llama 3.1.")

    col5, col6 = st.columns(2)

    with col5:
        product = st.text_input("Product or Topic:")
        target_audience = st.text_input("Target Audience:")
        video_duration = st.slider("Video Duration (seconds)", 15, 60, 30)
        tone = st.selectbox("Tone", ["Casual", "Professional", "Humorous", "Informative", "Enthusiastic"])

    with col6:
        key_features = st.text_area("Key Features or Benefits (one per line):")
        call_to_action = st.text_input("Call to Action:")
        include_categories = st.multiselect("Include Phrase Categories", list(categorized_phrases.keys()))

    use_ai_analysis = st.checkbox("Incorporate AI Analysis Insights", value=True)

    if st.button("Generate Script"):
        if product:
            try:
                context = prepare_context(categorized_phrases, top_words, ai_analysis, include_categories, use_ai_analysis)
                script_params = {
                    "product": product,
                    "target_audience": target_audience,
                    "video_duration": video_duration,
                    "tone": tone,
                    "key_features": key_features.split('\n'),
                    "call_to_action": call_to_action
                }
                
                messages = [
                    {"role": "system", "content": "You are an AI assistant that generates TikTok scripts for UGC creators based on successful patterns and AI analysis."},
                    {"role": "user", "content": f"Context:\n{context}\n\nGenerate a TikTok UGC script with the following parameters:\n{json.dumps(script_params, indent=2)}"}
                ]
                
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
            st.warning("Please enter a product or topic for the script.")

def prepare_context(categorized_phrases, top_words, ai_analysis, include_categories, use_ai_analysis):
    context = "Categorized phrases:\n"
    for category in include_categories:
        context += f"{category.capitalize()}: {', '.join([phrase for phrase, _ in categorized_phrases[category][:20]])}\n"
    context += f"\nTop words: {', '.join([word for word, _ in top_words[:30]])}\n"
    if use_ai_analysis:
        context += f"\nAI Analysis of Patterns:\n{ai_analysis}\n"
    return context

if __name__ == "__main__":
    create_dashboard()