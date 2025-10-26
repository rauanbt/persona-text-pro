import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    mode === "development" && {
      name: 'extension-bundle',
      configureServer(server: any) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url === '/extension-bundle') {
            const baseDir = path.resolve(__dirname, 'chrome-extension');
            const files = [
              'manifest.json',
              'config.js',
              'background.js',
              'content.js',
              'styles.css',
              'auth.js',
            ];
            const bundle = files
              .map((f) => {
                const fp = path.join(baseDir, f);
                try {
                  return `\n\n// ========== ${f} ========== \n\n${fs.readFileSync(fp, 'utf-8')}`;
                } catch (e) {
                  return `\n\n// ========== ${f} (NOT FOUND) ========== \n\n`;
                }
              })
              .join('\n');
            res.setHeader('Content-Type', 'text/plain');
            res.end(bundle);
          } else {
            next();
          }
        });
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
