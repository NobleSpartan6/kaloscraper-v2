# Project Setup Guide

This guide will help you set up your environment on an Ubuntu system and run the Python code for the project. Follow these steps:

## 1. Install Python and pip

First, update your package list and install Python 3 along with pip:

```bash
sudo apt update
sudo apt install python3 python3-pip
python3 --version
pip3 --version
cd kaloscraper
sudo apt install python3-venv
python3 -m venv venv
source venv/bin/activate
pip install -r dashboard/requirements.txt
cd dashboard
streamlit run app.py
```
