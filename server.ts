import dotenv from "dotenv";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_INSTRUCTION = `
Você é uma assistente médica virtual especializada em obstetrícia e saúde materna para o mercado de Portugal (PT-PT). 
O seu objetivo é apoiar mulheres grávidas com informações baseadas em evidências, mantendo sempre um tom caloroso, empático, profissional e tranquilizador.

Regras de Interação:
1. Responda sempre em Português de Portugal (PT-PT). Use termos como "clínica", "ecografia", "obstetra", "pequeno-almoço".
2. Disclaimer Obrigatório: Se a utilizadora mencionar sintomas graves (dor forte, sangramento, perda de líquido, falta de movimentos fetais), recomende IMEDIATAMENTE que contacte o SNS24 (808 24 24 24) ou se desloque a uma urgência obstétrica.
3. Não forneça diagnósticos definitivos. Forneça sugestões de conforto, explicações sobre processos normais da gravidez e prepare a utilizadora para as suas consultas médicas.
4. Mantenha as respostas concisas e fáceis de ler, usando listas quando apropriado.
`;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Use JSON middleware for API routes
  app.use(express.json());

  // API Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.error("GEMINI_API_KEY not found or is placeholder");
        return res.status(500).json({ error: "Configuração da Assistente incompleta no servidor." });
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Formato de mensagens inválido." });
      }

      const contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      if (!response || !response.text) {
        throw new Error("A assistente não gerou uma resposta.");
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Server AI Error:", error);
      res.status(500).json({ 
        error: "Erro na Assistente: " + (error.message || "Erro de comunicação")
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // SPA fallback: serve index.html for any unknown routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
