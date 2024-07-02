import { pipeline } from '@xenova/transformers';

class WordEmbeddingPipeline {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    let extractor = await WordEmbeddingPipeline.getInstance(x => {
        self.postMessage(x);
    });

    // Ensure we have a word to process
    if (!event.data.word) {
        self.postMessage({
            status: 'error',
            message: 'No word provided for embedding'
        });
        return;
    }

    // Calculate the embedding
    let output = await extractor(event.data.word, {
        pooling: 'mean',
        normalize: true,
    });

    // Send the output back to the main thread
    self.postMessage({
        status: 'complete',
        word: event.data.word,
        output: Array.from(output.data),
    });
});