
/**
 * A simple audio resampler to convert between different sample rates.
 * These implementations are basic but effective for fixing pitch issues 
 * in voice telephony applications.
 */

/**
 * Upsamples a Buffer of 16-bit Linear PCM audio from 8kHz to 16kHz.
 * It does this by simply duplicating each audio sample (zero-order hold).
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
 * It does this by averaging pairs of samples, which acts as a simple low-pass
 * filter to reduce aliasing and produce a cleaner sound than simple decimation.
 * @param {Buffer} buffer16k - Buffer containing 16kHz, 16-bit PCM audio.
 * @returns {Buffer} - Buffer containing 8kHz, 16-bit PCM audio.
 */
function downsample16kTo8k(buffer16k) {
    // Calculate the number of samples in the 16kHz buffer.
    const numSamples16k = buffer16k.length / 2;
    // The 8kHz buffer will have half the number of samples.
    const numSamples8k = Math.floor(numSamples16k / 2);
    // Allocate memory for the new buffer. Each sample is 2 bytes (16-bit).
    const buffer8k = Buffer.alloc(numSamples8k * 2);

    for (let i = 0; i < numSamples8k; i++) {
        // For each new sample in the 8k buffer, we look at a pair of samples in the 16k buffer.
        // The pair is at index 2*i and 2*i + 1.
        // The byte offset is (2*i * 2) = 4*i and ((2*i + 1) * 2) = 4*i + 2.
        
        const sample1 = buffer16k.readInt16LE(i * 4);
        const sample2 = buffer16k.readInt16LE(i * 4 + 2);
        
        // We average the two samples to create the new, downsampled sample.
        const avgSample = Math.round((sample1 + sample2) / 2);
        
        // Write the averaged sample to the 8k buffer.
        buffer8k.writeInt16LE(avgSample, i * 2);
    }
    return buffer8k;
}


export {
    upsample8kTo16k,
    downsample16kTo8k
};