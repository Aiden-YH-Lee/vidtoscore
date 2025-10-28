from flask import Flask

app = Flask(__name__)

# POST


@app.route('/api/video/upload', methods=['POST'])
def upload_video():
    print("Hello world")
    pass


@app.route('/api/video/extract')
def extract():
    pass


if __name__ == '__main__':
    app.run(debug=True)
