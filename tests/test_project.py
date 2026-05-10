# все что начинается с test_ и с assert внутри = pytest
import requests

BASE_URL = "http://localhost:80"

def test_sum():
    assert 2+2==4

def test_github_api():
    response = requests.get("https://api.github.com")
    assert response.status_code == 200

def test_homepage():
    response = requests.get(BASE_URL
 + "/")
    assert response.status_code == 200
def test_api():
    response = requests.get(BASE_URL
 + "/api/")
    assert response.status_code != 502 #не упал ли бэкенд
def test_proxy_headers():
    response = requests.get(BASE_URL
 + "/api/test")
    assert "server" in response.headers or response.status_code < 500