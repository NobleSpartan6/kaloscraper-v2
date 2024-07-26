import streamlit as st
import plotly.express as px
from analysis import preprocess_scripts, identify_patterns, rank_videos
import os

def create_dashboard():
    st.title("TikTok Script Analysis Dashboard")

    # User Guide
    st.sidebar.header("User Guide")
    st.sidebar.write("""
    1. **Top Performing Videos**: Displays a table of the top-performing videos based on various metrics.
    2. **Common Phrases**: Shows a bar chart of the most common phrases found in the scripts.
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
    top_phrases, top_words = identify_patterns(df)

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

    st.header("Common Phrases")
    fig_phrases = px.bar(x=[phrase for phrase, _ in top_phrases], y=[score for _, score in top_phrases])
    st.plotly_chart(fig_phrases)

    st.header("Common Words")
    fig_words = px.bar(x=[word for word, _ in top_words], y=[count for _, count in top_words])
    st.plotly_chart(fig_words)

    st.header("Performance Metrics")
    metric = st.selectbox("Select Metric", ['items_sold', 'revenue', 'views', 'gpm'])
    fig_metric = px.scatter(df, x='score', y=metric, hover_data=['title'])
    st.plotly_chart(fig_metric)

if __name__ == "__main__":
    create_dashboard()