const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "https://santoshnishad2612008-hub.github.io"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "AI Video Generator backend is running"
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({
        error: "Please enter a valid prompt."
      });
    }

    const apiKey = process.env.PIXAZO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "PIXAZO_API_KEY is not configured."
      });
    }

    const response = await fetch(
      "https://gateway.pixazo.ai/ltx/text-to-video",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": apiKey
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
          "Video generation failed.",
        details: data
      });
    }

    res.json(data);

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      error: "Server error while generating video."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AI Video Generator running on 0.0.0.0:${PORT}`
  );
});
