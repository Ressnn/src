import { useEffect, useRef, useState } from 'react'
import Progress from './components/Progress';

import './App.css'

const positiveQualities = [
  "Clean", "Honest", "Loyal", "Trustworthy", "Dependable",
  "Thoughtful", "Wise", "Mature", "Ethical", "Courageous",
  "Productive", "Progressive", "Observant", "Neat", "Punctual",
  "Logical", "Prompt", "Accurate", "Self-Reliant", "Independent",
  "Inventive", "Wholesome", "Attentive", "Frank", "Purposeful",
  "Realistic", "Adventurous", "Modern", "Charming", "Modest",
  "Persistent", "Polite", "Patient", "Talented", "Perceptive",
  "Forgiving", "Respectful", "Grateful", "Resourceful", "Courteous",
  "Helpful", "Appreciative", "Imaginative", "Self-Disciplined",
  "Decisive", "Humble", "Self-Confident", "Consistent",
  "Artistic", "Fashionable", "Convincing", "Thrifty", "Suave",
  "Methodical", "Interesting", "Selfless", "Responsible",
  "Reasonable", "Proficient", "Inspiring"
];

const big5Traits = [
  { name: "Openness", low: "Rational", high: "Creative" },
  { name: "Conscientiousness", low: "Easygoing", high: "Efficient" },
  { name: "Extraversion", low: "Introverted", high: "Extraverted" },
  { name: "Agreeableness", low: "Assertive", high: "Friendly" },
  { name: "Emotional Reactivity", low: "Confident", high: "Sensitive" }
];

const nameBasket = [
  // Common English names
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "William", "Mia", "James", "Charlotte", "Benjamin", "Amelia",
  "Elijah", "Harper", "Lucas", "Evelyn", "Alexander",

  // More complex or longer English names
  "Penelope", "Theodore", "Josephine", "Maximilian", "Genevieve", "Nathaniel",
  "Evangeline", "Remington", "Clementine", "Sebastian",

  // Names from various cultures
  "Muhammad", "Wei", "Fatima", "Hiroshi", "Zainab", "Giovanni", "Yuki", "Rajesh",
  "Ingrid", "Alejandro", "Anastasia", "Kwame", "Siobhan", "Dmitri", "Aoife",

  // Compound names
  "Mary-Jane", "Jean-Luc", "Anna-Maria", "John-Paul", "Sarah-Louise",

  // Names with apostrophes or hyphens
  "O'Connor", "D'Angelo", "Smith-Johnson", "Al-Hassan", "Saint-Clair",

  // Names with accents or special characters
  "Zoë", "Renée", "Håkon", "Núñez", "Søren", "Françoise", "Björn",

  // Unique or modern names
  "Blue", "North", "Sage", "River", "Sky", "Phoenix", "Raven",

  // Historical or literary names
  "Aristotle", "Shakespeare", "Cleopatra", "Galileo", "Austen", "Darwin",

  // Names from mythology
  "Athena", "Thor", "Isis", "Apollo", "Freya", "Odin", "Persephone", "Indra", 

  // Names from popular culture
  "Khaleesi", "Anakin", "Hermione", "Katniss", "Sherlock", "Tyrion",

  // Very long names
  "Maximilian-Bartholomew", "Anastasia-Genevieve", "Christopher-Alexander",

  // Names starting with less common letters
  "Xavier", "Quincy", "Ursula", "Zander", "Yvette", "Ulysses"
];

const NUM_TRAITS_TO_SHOW = 5;
const DEBUG_MODE = false;

function App() {
  const [ready, setReady] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [progressItems, setProgressItems] = useState([]);
  const [input, setInput] = useState('');
  const [inputEmbedding, setInputEmbedding] = useState(null);
  const [qualityEmbeddings, setQualityEmbeddings] = useState({});
  const [big5Embeddings, setBig5Embeddings] = useState({});
  const [nameEmbeddings, setNameEmbeddings] = useState({});
  const [nameQualities, setNameQualities] = useState([]);
  const [namePersonality, setNamePersonality] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');
  const worker = useRef(null);
  const [processingStage, setProcessingStage] = useState('idle');
  const [expectedWord, setExpectedWord] = useState('');
  const [showResults, setShowResults] = useState(false);

  const addDebugInfo = (info) => {
    if (DEBUG_MODE) {
      console.log(info);
      setDebugInfo(prev => prev + '\n' + info);
    }
  };

  const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      addDebugInfo(`Invalid vectors: vecA length: ${vecA?.length}, vecB length: ${vecB?.length}`);
      return 0;
    }
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) {
      addDebugInfo(`Zero magnitude: magnitudeA: ${magnitudeA}, magnitudeB: ${magnitudeB}`);
      return 0;
    }
    return dotProduct / (magnitudeA * magnitudeB);
  };

  const calculateZScore = (value, mean, stdDev) => {
    return (value - mean) / stdDev;
  };

  const calculatePercentile = (zScore) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
    const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
    const probability = 1 - d * ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.319381530) * t;
    return zScore > 0 ? probability : 1 - probability;
  };

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    }

    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case 'initiate':
          setReady(false);
          setProgressItems(prev => [...prev, e.data]);
          break;
        case 'progress':
          setProgressItems(prev => prev.map(item => 
            item.file === e.data.file ? { ...item, progress: e.data.progress } : item
          ));
          break;
        case 'done':
          setProgressItems(prev => prev.filter(item => item.file !== e.data.file));
          break;
        case 'ready':
          setReady(true);
          break;
        case 'complete':
          if (!e.data.word && !expectedWord) {
            addDebugInfo(`Error: Received embedding for undefined word. Data: ${JSON.stringify(e.data)}`);
            return;
          }
          const word = e.data.word || expectedWord;
          if (processingStage === 'input') {
            addDebugInfo(`Received input embedding for "${word}". Length: ${e.data.output.length}`);
            setInputEmbedding(e.data.output);
            setProcessingStage('qualities');
          } else if (processingStage === 'qualities') {
            addDebugInfo(`Received quality embedding for "${word}"`);
            setQualityEmbeddings(prev => ({...prev, [word]: e.data.output}));
          } else if (processingStage === 'big5') {
            addDebugInfo(`Received Big 5 embedding for "${word}"`);
            setBig5Embeddings(prev => ({...prev, [word]: e.data.output}));
          } else if (processingStage === 'names') {
            addDebugInfo(`Received name embedding for "${word}"`);
            setNameEmbeddings(prev => ({...prev, [word]: e.data.output}));
          }
          setExpectedWord('');
          break;
      }
    };

    worker.current.addEventListener('message', onMessageReceived);
    return () => worker.current.removeEventListener('message', onMessageReceived);
  }, [processingStage, expectedWord]);

  const processQualities = () => {
    if (!inputEmbedding) {
      addDebugInfo('Error: Attempting to process qualities without input embedding');
      return;
    }
    addDebugInfo(`Processing qualities. Input embedding length: ${inputEmbedding.length}`);
    positiveQualities.forEach(quality => {
      setExpectedWord(quality);
      worker.current.postMessage({ word: quality });
    });
  };

  const processBig5 = () => {
    addDebugInfo(`Processing Big 5 traits.`);
    big5Traits.forEach(trait => {
      setExpectedWord(trait.low);
      worker.current.postMessage({ word: trait.low });
      setExpectedWord(trait.high);
      worker.current.postMessage({ word: trait.high });
    });
  };

  const processNames = () => {
    addDebugInfo(`Processing name basket.`);
    nameBasket.forEach(name => {
      setExpectedWord(name);
      worker.current.postMessage({ word: name });
    });
  };

  const analyzeNames = () => {
    if (!input.trim()) {
      addDebugInfo('Error: Please enter a name');
      return;
    }
    setDisabled(true);
    setNameQualities([]);
    setNamePersonality([]);
    setInputEmbedding(null);
    setQualityEmbeddings({});
    setBig5Embeddings({});
    setNameEmbeddings({});
    setProcessingStage('input');
    setDebugInfo('Starting analysis...');
    setExpectedWord(input);
    addDebugInfo(`Requesting embedding for: ${input}`);
    setShowResults(false);
    worker.current.postMessage({ word: input });
  }

  useEffect(() => {
    if (processingStage === 'qualities' && inputEmbedding) {
      processQualities();
    }
  }, [processingStage, inputEmbedding]);

  useEffect(() => {
    if (Object.keys(qualityEmbeddings).length === positiveQualities.length) {
      setProcessingStage('big5');
      processBig5();
    }
  }, [qualityEmbeddings]);

  useEffect(() => {
    if (Object.keys(big5Embeddings).length === big5Traits.length * 2) {
      setProcessingStage('names');
      processNames();
    }
  }, [big5Embeddings]);

  useEffect(() => {
    if (Object.keys(nameEmbeddings).length === nameBasket.length) {
      // Process character associations
      const qualityStats = positiveQualities.reduce((acc, quality) => {
        const similarities = nameBasket.map(name => 
          cosineSimilarity(nameEmbeddings[name], qualityEmbeddings[quality])
        );
        const mean = similarities.reduce((sum, val) => sum + val, 0) / similarities.length;
        const variance = similarities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / similarities.length;
        const stdDev = Math.sqrt(variance);
        acc[quality] = { mean, stdDev };
        return acc;
      }, {});

      const qualities = positiveQualities.map(quality => {
        const similarity = cosineSimilarity(inputEmbedding, qualityEmbeddings[quality]);
        const { mean, stdDev } = qualityStats[quality];
        const zScore = calculateZScore(similarity, mean, stdDev);
        return {
          quality,
          similarity,
          zScore,
          percentile: calculatePercentile(zScore)
        };
      });

      setNameQualities(qualities.sort((a, b) => b.percentile - a.percentile).slice(0, NUM_TRAITS_TO_SHOW));

      // Process personality associations
      const personalityStats = big5Traits.reduce((acc, trait) => {
        const similarities = nameBasket.map(name => {
          const lowSim = cosineSimilarity(nameEmbeddings[name], big5Embeddings[trait.low]);
          const highSim = cosineSimilarity(nameEmbeddings[name], big5Embeddings[trait.high]);
          return highSim / (lowSim + highSim);
        });
        const mean = similarities.reduce((sum, val) => sum + val, 0) / similarities.length;
        const variance = similarities.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / similarities.length;
        const stdDev = Math.sqrt(variance);
        acc[trait.name] = { mean, stdDev };
        return acc;
      }, {});

      const personality = big5Traits.map(trait => {
        const lowSim = cosineSimilarity(inputEmbedding, big5Embeddings[trait.low]);
        const highSim = cosineSimilarity(inputEmbedding, big5Embeddings[trait.high]);
        const score = highSim / (lowSim + highSim);
        const { mean, stdDev } = personalityStats[trait.name];
        const zScore = calculateZScore(score, mean, stdDev);
        return {
          trait: trait.name,
          low: trait.low,
          high: trait.high,
          score,
          zScore,
          percentile: calculatePercentile(zScore)
        };
      });

      setNamePersonality(personality);
      
      setDisabled(false);
      setProcessingStage('idle');
      setShowResults(true);
      addDebugInfo('Analysis complete');
    }
  }, [nameEmbeddings, qualityEmbeddings, big5Embeddings, inputEmbedding]);

  return (
    <>
      <h1>Name Analysis AI</h1>
      <h2>Discover character and personality traits associated with names</h2>

      <div className='container'>
        <div className='textbox-container'>
          <input 
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter a name"
          />
        </div>
      </div>

      <button disabled={disabled} onClick={analyzeNames}>Analyze Name</button>

      {showResults && (
        <>
          <h3>Top Character Associations</h3>
          <div className='qualities-container'>
            {nameQualities.map(({ quality, percentile }) => (
              <div key={quality} className='quality-card'>
                <div className='quality-name'>{quality}</div>
                <div className='quality-bar'>
                  <div className='quality-fill' style={{ width: `${percentile * 100}%` }}></div>
                </div>
                <div className='quality-percentile'>{(percentile * 100).toFixed(0)}% Match</div>
              </div>
            ))}
          </div>

          <h3>Personality Associations</h3>
          <div className='personality-container'>
            {namePersonality.map(({ trait, low, high, percentile }) => (
              <div key={trait} className='personality-card'>
                <div className='personality-name'>{trait}</div>
                <div className='personality-scale'>
                  <span className='personality-low'>{low}</span>
                  <div className='personality-bar'>
                    <div className='personality-marker' style={{ left: `${percentile * 100}%` }}></div>
                  </div>
                  <span className='personality-high'>{high}</span>
                </div>
                <div className='personality-percentile'>{(percentile * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
          
          <h3>How it Works</h3>

         <p>This site probes the internals thoughts of language models (like ChatGPT) to gauge what they think when they see a name. By comparing how close it thinks a name is to certain concepts, we can see how similar these models think the two are. Since these are trained on a large corpus of text data from people, it tends to align with the traits people associate with names.</p>
         
        </>
      )}

      {DEBUG_MODE && (
        <div className='debug-container'>
          <h3>Debug Information:</h3>
          <pre>{debugInfo}</pre>
        </div>
      )}

      {DEBUG_MODE && (
        <div className='progress-bars-container'>
          {ready === false && (
            <label>Loading embedding models...</label>
          )}
          {progressItems.map(data => (
            <div key={data.file}>
              <Progress text={data.file} percentage={data.progress} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default App