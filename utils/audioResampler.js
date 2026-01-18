
/**
 * A simple audio resampler to convert between different sample rates.
 * These implementations are basic (using duplication and decimation) and may not be 
 * suitable for high-fidelity music, but they are effective for fixing pitch issues 
 * in voice telephony applications.
 */

/**
 * Upsamples a Buffer of 16-bit Linear PCM audio from 8kHz to 16kHz.
 * It does this by simply duplicating each audio sample.
 * @param {Buffer} buffer8k - Buffer containing 8kHz, 16-bit PCM audio.
 * @returns {Buffer} - Buffer containing 16kHz, 16-bit PCM audio.
 */
function upsample8kTo16k(buffer8k) {
    const newLength = buffer8k.length * 2;
    const buffer16k = Buffer.alloc(newLength);
    for (let i = 0; i < buffer8k.length / 2; i++) {
        const sample = buffer8k.readInt16LE(i * 2);
        buffer16k.writeInt16LE(sample, i * 4);
        buffer16k.writeInt16LE(sample, i * 4 + 2); // Duplicate the sample
    }
    return buffer16k;
}

/**
 * Downsamples a Buffer of 16-bit Linear PCM audio from 16kHz to 8kHz.
 * It does this by discarding every other sample (decimation).
 * @param {Buffer} buffer16k - Buffer containing 16kHz, 16-bit PCM audio.
 * @returns {Buffer} - Buffer containing 8kHz, 16-bit PCM audio.
 */
function downsample16kTo8k(buffer16k) {
    const newLength = Math.floor(buffer16k.length / 2);
    // Ensure the new length is a multiple of 2 for 16-bit samples
    const finalLength = newLength % 2 === 0 ? newLength : newLength - 1;
    const buffer8k = Buffer.alloc(finalLength);

    for (let i = 0; i < finalLength / 2; i++) {
        // Read every other sample from the original buffer (at byte offsets 0, 4, 8, ...)
        const sample = buffer16k.readInt16LE(i * 4);
        // Write the sample to the new buffer (at byte offsets 0, 2, 4, ...)
        buffer8k.writeInt16LE(sample, i * 2);
    }
    return buffer8k;
}


export {
    upsample8kTo16k,
    downsample16kTo8k
};
