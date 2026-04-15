import * as net from 'net';
import { TOR_CONFIG } from './types';

/**
 * Pure JavaScript Tor Control Protocol implementation.
 * No external dependencies — uses Node.js built-in `net` module.
 *
 * Tor Control Protocol: https://gitweb.torproject.org/torspec.git/tree/control-spec.txt
 */

let isConnected = false;

function sendCommand(socket: net.Socket, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    socket.once('data', (chunk) => {
      data += chunk.toString();
      resolve(data);
    });
    socket.once('error', reject);
    socket.write(`${command}\r\n`);
  });
}

export async function signalNewNYM(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      {
        host: TOR_CONFIG.controlHost,
        port: TOR_CONFIG.controlPort,
      },
      () => {
        // Authenticate using the hashed password from torrc
        // Tor Control Protocol: authenticate with HashPassword cookie
        const authCmd = `AUTHENTICATE "${TOR_CONFIG.hashedPassword}"`;
        sendCommand(socket, authCmd)
          .then((authResponse) => {
            if (!authResponse.startsWith('250')) {
              socket.end();
              reject(new Error(`Tor auth failed: ${authResponse.trim()}`));
              return;
            }
            // Send NEWNYM signal to rotate to a new circuit
            return sendCommand(socket, 'SIGNAL NEWNYM');
          })
          .then((nymResponse) => {
            socket.end();
            if (nymResponse && nymResponse.startsWith('250')) {
              console.log('[tor] Circuit rotated (SIGNAL NEWNYM sent)');
              isConnected = true;
              resolve();
            } else {
              reject(new Error(`SIGNAL NEWNYM failed: ${nymResponse?.trim()}`));
            }
          })
          .catch((err) => {
            socket.end();
            reject(err);
          });
      }
    );

    socket.once('error', (err) => {
      reject(new Error(`Tor control connection failed: ${err.message}`));
    });

    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error('Tor control connection timeout'));
    });
  });
}

export async function testTorConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(
      {
        host: TOR_CONFIG.controlHost,
        port: TOR_CONFIG.controlPort,
      },
      () => {
        sendCommand(socket, 'AUTHENTICATE')
          .then((r) => {
            socket.end();
            resolve(r.startsWith('250'));
          })
          .catch(() => {
            socket.end();
            resolve(false);
          });
      }
    );
    socket.once('error', () => resolve(false));
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export function isTorConnected(): boolean {
  return isConnected;
}
