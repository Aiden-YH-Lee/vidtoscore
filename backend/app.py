from flask import Flask, request
from extractor import extract
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

# POST


@app.route('/api/video/upload', methods=['POST'])
def upload_video():
    # print("Hello world")
    json = request.json
    print(json)

    return json


@app.route('/api/video/extract')
def extract():
    pass
