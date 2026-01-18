
// G.711 mu-law compression/expansion algorithm for audio conversion.
// This is necessary to convert between Twilio's audio format (mu-law)
// and Gemini's required format (16-bit Linear PCM).

const BIAS = 0x84; // 132
const MAX_VAL = 32635;

// Converts a 16-bit Linear PCM sample to an 8-bit mu-law sample.
function linear16ToMuLawSample(sample) {
    let sign = (sample >> 8) & 0x80;
    if (sign) sample = -sample;
    if (sample > MAX_VAL) sample = MAX_VAL;

    sample = sample + BIAS;

    let exponent = 7;
    for (let i = 0x4000; i > 0; i >>= 1) {
        if (sample & i) break;
        exponent--;
    }

    let mantissa = (sample >> (exponent + 3)) & 0x0F;
    let companded = (sign | (exponent << 4) | mantissa);
    return ~companded;
}

// Converts an 8-bit mu-law sample to a 16-bit Linear PCM sample.
function muLawToLinear16Sample(mulaw) {
    mulaw = ~mulaw;
    let sign = (mulaw & 0x80);
    let exponent = (mulaw >> 4) & 0x07;
    let mantissa = mulaw & 0x0F;
    let sample = (mantissa << 3) + 0x84;
    sample <<= exponent;
    sample -= BIAS;
    return (sign) ? -sample : sample;
}

/**
 * Converts a Buffer of 16-bit Linear PCM audio to 8-bit mu-law audio.
 * @param {Buffer} linear16Buffer - Buffer containing 16-bit PCM audio samples.
 * @returns {Buffer} - Buffer containing 8-bit mu-law audio samples.
 */
function linear16ToMulaw(linear16Buffer) {
    const mulawBuffer = Buffer.alloc(linear16Buffer.length / 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
        const sample = linear16Buffer.readInt16LE(i * 2);
        mulawBuffer[i] = linear16ToMuLawSample(sample);
    }
    return mulawBuffer;
}

/**
 * Converts a Buffer of 8-bit mu-law audio to 16-bit Linear PCM audio.
 * @param {Buffer} mulawBuffer - Buffer containing 8-bit mu-law audio samples.
 * @returns {Buffer} - Buffer containing 16-bit PCM audio samples.
 */
function mulawToLinear16(mulawBuffer) {
    const linear16Buffer = Buffer.alloc(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
        const sample = muLawToLinear16Sample(mulawBuffer[i]);
        linear16Buffer.writeInt16LE(sample, i * 2);
    }
    return linear16Buffer;
}

export {
    linear16ToMulaw,
    mulawToLinear16
};
