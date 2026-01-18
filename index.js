
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import twilio from 'twilio';
const { VoiceResponse } = twilio.twiml;
import { GoogleGenAI, Modality } from '@google/genai';

import { tools } from './services/geminiService.js';
import { getAvailableCategories, getAvailableAppointments, bookAppointment } from './services/clinicService.js';
import { mulawToLinear16, linear16ToMulaw } from './utils/audioConverter.js';
import { upsample8kTo16k, downsample16kTo8k } from './utils/audioResampler.js';

// Debug log to check available environment variables at startup
console.log('Server starting... Available ENV keys:', Object.keys(process.env));

const app = express();
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Endpoint that Twilio calls when a phone call comes in
app.post('/voice', (req, res) => {
  try {
    console.log('Received incoming call...');
    // CRITICAL: Check if PUBLIC_URL is set. This is a common cause of crashes.
    if (!process.env.PUBLIC_URL) {
        console.error('FATAL: PUBLIC_URL environment variable is not set on the server.');
        res.status(500).type('text/plain').send('Server configuration error: PUBLIC_URL is not set.');
        return;
    }

    const response = new VoiceResponse();
    const connect = response.connect();
    // Ensure PUBLIC_URL does not have protocol for wss URL
    const publicUrl = process.env.PUBLIC_URL.replace(/^https?:\/\//, '');
    const streamUrl = `wss://${publicUrl}/media`;
    
    console.log(`Connecting to WebSocket stream: ${streamUrl}`);
    connect.stream({
      url: streamUrl,
    });

    res.type('text/xml');
    res.send(response.toString());
  } catch (error) {
      console.error('Unhandled error in /voice handler:', error);
      res.status(500).type('text/plain').send('Internal Server Error');
  }
});

// WebSocket connection handler for the audio stream
wss.on('connection', (ws) => {
  console.log('Media stream connection established.');
  
  // CRITICAL: Check if API_KEY is set.
  if (!process.env.API_KEY) {
      console.error('FATAL: API_KEY is not set. Closing WebSocket connection.');
      ws.close(1011, 'Server configuration error: API_KEY not set.');
      return;
  }
  
  let geminiSession;
  let streamSid;
  let isCallActive = false;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [tools],
          systemInstruction: `Esti un receptioner virtual pentru o clinica medicala, prietenos si eficient. Scopul tau este sa ajuti pacientii sa isi faca programari. Fii politicos si clar.
          Vei incepe conversatia salutand apelantul si intrebandu-l cu ce il poti ajuta.
          Fluxul conversatiei trebuie sa fie urmatorul, pas cu pas:
          1. Intreaba pacientul la ce sectie (categorie) doreste programare. Apoi apeleaza functia 'getAvailableCategories' pentru a vedea optiunile si ID-ul sectiei corecte. Confirma cu pacientul sectia aleasa.
          2. Intreaba pacientul pentru ce data doreste programare. Apoi apeleaza 'getAvailableAppointments' folosind ID-ul sectiei pentru a vedea orele libere in acea zi. Prezinta optiunile pacientului.
          3. Dupa ce pacientul alege o ora, spune-i ca pentru a finaliza programarea ai nevoie de cateva date. Apoi, cere-i pe rand detaliile personale necesare: Nume complet, Cod Numeric Personal (CNP) si numar de telefon.
          4. Dupa ce ai TOATE aceste informatii (ID-ul sectiei, data, ora, nume, CNP, telefon), apeleaza functia 'bookAppointment' pentru a finaliza programarea.
          5. Confirma pacientului ca programarea a fost facuta cu succes, folosind mesajul de succes de la API.
          Nu inventa informatii, foloseste intotdeauna uneltele (tools) care iti sunt oferite.`
        },
        callbacks: {
            onopen: () => {
                console.log('Gemini session opened.');
            },
            onmessage: async (message) => {
                try {
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            console.log(`Gemini called tool: ${fc.name}(${JSON.stringify(fc.args)})`);
                            let result;
                            try {
                                if (fc.name === 'getAvailableCategories') {
                                    result = await getAvailableCategories();
                                } else if (fc.name === 'getAvailableAppointments') {
                                    result = await getAvailableAppointments(fc.args.categoryId, fc.args.startDate, fc.args.endDate);
                                } else if (fc.name === 'bookAppointment') {
                                    result = await bookAppointment(fc.args);
                                } else {
                                    result = { error: 'Functie necunoscuta' };
                                }
                            } catch (e) {
                                console.error("Error executing tool:", e);
                                result = { error: e.message };
                            }
                            
                            const resultString = JSON.stringify(result);
                            console.log(`Sending tool response to Gemini: ${resultString}`);
                            geminiSession?.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: resultString },
                                }
                            });
                        }
                    }
                    
                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData) {
                        // Audio from Gemini is 16-bit Linear PCM at 16kHz
                        const linear16Audio_16k = Buffer.from(audioData, 'base64');
                        // Downsample to 8kHz for Twilio
                        const linear16Audio_8k = downsample16kTo8k(linear16Audio_16k);
                        // Convert to 8-bit mu-law for Twilio
                        const mulawAudio = linear16ToMulaw(linear16Audio_8k);
                        const mulawBase64 = mulawAudio.toString('base64');
                        
                        const mediaMessage = {
                            event: 'media',
                            streamSid: streamSid,
                            media: {
                                payload: mulawBase64, 
                            },
                        };
                        ws.send(JSON.stringify(mediaMessage));
                    }
                } catch (error) {
                    console.error('Error processing message from Gemini:', error);
                }
            },
            onerror: (e) => console.error('Gemini error:', e),
            onclose: () => console.log('Gemini session closed.'),
        }
    });

  sessionPromise.then(session => {
      geminiSession = session;
      console.log('Gemini session promise resolved.');
      if (isCallActive) {
          console.log('Call is active, sending initial text to Gemini to start conversation.');
          geminiSession.sendRealtimeInput({ text: 'Saluta apelantul si intreaba-l cu ce il poti ajuta.' });
      }
  });
  
  ws.on('message', (message) => {
    try {
        const msg = JSON.parse(message);

        switch (msg.event) {
          case 'connected':
            console.log('Twilio connected event received.');
            break;
          case 'start':
            console.log('Twilio start event received.');
            streamSid = msg.start.streamSid;
            isCallActive = true;
            if (geminiSession) {
                console.log('Gemini session is ready, sending initial text to start conversation.');
                geminiSession.sendRealtimeInput({ text: 'Saluta apelantul si intreaba-l cu ce il poti ajuta.' });
            }
            break;
          case 'media':
            if (geminiSession) {
                // Audio from Twilio is 8-bit mu-law at 8kHz
                const mulawAudio = Buffer.from(msg.media.payload, 'base64');
                // Convert to 16-bit Linear PCM at 8kHz
                const linear16Audio_8k = mulawToLinear16(mulawAudio);
                // Upsample to 16kHz for Gemini
                const linear16Audio_16k = upsample8kTo16k(linear16Audio_8k);
                const linear16Base64 = linear16Audio_16k.toString('base64');

                geminiSession.sendRealtimeInput({
                    media: {
                        data: linear16Base64, 
                        mimeType: 'audio/pcm;rate=16000',
                    }
                });
            }
            break;
          case 'stop':
            console.log('Twilio stop event received. Call has ended.');
            isCallActive = false;
            geminiSession?.close();
            break;
        }
    } catch(error) {
        console.error('Error processing message from Twilio:', error);
    }
  });

  ws.on('close', () => {
    console.log('Media stream connection closed.');
    geminiSession?.close();
  });
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  if (process.env.PUBLIC_URL) {
      console.log('Please configure your Twilio phone number to use the following webhook URL for voice calls:');
      console.log(`${process.env.PUBLIC_URL}/voice`);
  } else {
      console.warn('PUBLIC_URL environment variable is not set. You will need to set it for Twilio integration.');
  }
});