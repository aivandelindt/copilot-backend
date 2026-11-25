import type { Server } from "node:http";
import type { Express } from "express";

export function listen(app: Express, host: string, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
  });
}
