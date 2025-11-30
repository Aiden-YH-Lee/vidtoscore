# vidtoscore

extract scores from videos into a pdf.

## Frontend

- Allows user to input a youtube url for a video they want.
- Move to an edit page, which displays the video like a video editor.
  - Time parameters:
    - User inputs manually the start and end of video they want to extract / can also have sliders
    - User inputs or slides interval
    - So start, end, and interval information provided
  - Image parameters:
    - Shows the video, and allow user to select the region to extract.
- Extract the image section from each video frame according to start, end, interval
- Maybe give user the option to resize the images, the space between each images, and how many images to put in one page.

## Backend

- First takes the url, downloads, then send to frontend to display in editing page.
- For second part, take the time parameters and image section and return the list of images.

## Running the Project

### Run Backend

1. Navigate to the `backend` directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the Flask application (runs on port 8080):

   ```bash
   flask run --port 8080
   ```
