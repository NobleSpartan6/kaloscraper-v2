# Python Environment Reference

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
