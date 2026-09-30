FROM python:3.13

WORKDIR /app

RUN apt-get update && \
    apt-get install -y ffmpeg curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Deno is yt-dlp's default JS runtime for solving YouTube's signature challenge -
# it sandboxes the fetched player script (no filesystem/network access), unlike
# a plain Node install. Pin the version deliberately rather than tracking latest.
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s v2.3.0
ENV PATH="/usr/local/bin:${PATH}"

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

CMD ["flask", "run", "--host=0.0.0.0", "--port=8080"]
