const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.PIXAZO_API_KEY;

if (!API_KEY) {
  console.warn("WARNING: PIXAZO_API_KEY is not configured.");
}

// ===============================
// Generate Video
// ===============================

app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({
        error: "Please enter a valid video prompt."
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        error: "Pixazo API key is not configured on server."
      });
    }

    const response = await fetch(
      "https://gateway.pixazo.ai/ltx/text-to-video",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": API_KEY
        },

        body: JSON.stringify({
          prompt: prompt.trim()
        })
      }
    );

    const data = await response.json();

    console.log("Pixazo response:", data);

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.message ||
          data.error ||
          "Pixazo video generation failed."
      });
    }

    // --------------------------------
    // Case 1: Direct video URL
    // --------------------------------

    const directVideo =
      data.output_url ||
      data.video_url ||
      data.url ||
      data.output?.media_url?.[0];

    if (directVideo) {
      return res.json({
        status: "COMPLETED",
        video_url: directVideo
      });
    }

    // --------------------------------
    // Case 2: Async request
    // --------------------------------

    if (data.request_id) {

      const requestId = data.request_id;

      const videoUrl = await waitForVideo(requestId);

      if (!videoUrl) {
        return res.status(500).json({
          error: "Video generation failed or timed out."
        });
      }

      return res.json({
        status: "COMPLETED",
        video_url: videoUrl
      });
    }

    return res.status(500).json({
      error: "Pixazo response did not contain a video URL or request ID.",
      pixazo_response: data
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Server error while generating video."
    });
  }
});


// ===============================
// Wait for Pixazo video
// ===============================

async function waitForVideo(requestId) {

  const maxAttempts = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {

    await sleep(5000);

    const response = await fetch(
      `https://gateway.pixazo.ai/v2/requests/status/${encodeURIComponent(requestId)}`,
      {
        method: "GET",

        headers: {
          "Ocp-Apim-Subscription-Key": API_KEY
        }
      }
    );

    const data = await response.json();

    console.log(
      `Video status (${attempt + 1}/${maxAttempts}):`,
      data.status
    );

    // -----------------------------
    // Completed
    // -----------------------------

    if (data.status === "COMPLETED") {

      const url =
        data.output?.media_url?.[0] ||
        data.output_url ||
        data.video_url ||
        data.url;

      return url || null;
    }

    // -----------------------------
    // Failed
    // -----------------------------

    if (
      data.status === "FAILED" ||
      data.status === "ERROR"
    ) {

      console.error(
        "Pixazo generation error:",
        data.error
      );

      return null;
    }
  }

  return null;
}


// ===============================
// Sleep
// ===============================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ===============================
// Start server
// ===============================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "AI Video Generator backend is running"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Video Generator running on 0.0.0.0:${PORT}`);
});

