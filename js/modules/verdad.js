/**
 * SOVEREIGN // AEGIS — VERDAD Real-Time Multi-Modal Claim Verification Module
 * 5-Step Epistemic Chain-of-Thought Dialectic, Adversarial Sandbox Challenge Mode,
 * Inline Source Credibility Dossiers with Admiralty Ratings, Heuristic NLP Parser, BYOK Gemini API.
 */

import { esc, sanitizeDeep, escUrl } from '../security.js';
import { searchFactChecks } from '../factcheck.js';
import { buildBookmarklet } from '../ingest.js';
import { recordAttempt, CONTEXTS, startTimer } from '../attempts.js';

export class VerdadEngine {
  /**
   * Transport seam for tests. Left null in production so the global `fetch` is used.
   * @type {null | typeof fetch}
   */
  static fetchImpl = null;

  /**
   * In-memory cache for datasets loaded at runtime.
   */
  static sourcesDatabase = null;
  static fallaciesDatabase = null;

  static defaultRules = {
    emotionalLexicons: {
      outrage: ['outrage', 'shameful', 'disgrace', 'treason', 'furious', 'unacceptable', 'scandal', 'corrupt', 'disgusting', 'abhorrent', 'infuriating', 'liar', 'lunatic', 'criminal', 'evil', 'wicked', 'fraudster', 'treasonous', 'traitor', 'monstrous', 'tyranny', 'tyrant', 'scandalous', 'depraved', 'vile', 'atrocity', 'unforgivable', 'sickening', 'shameless', 'abomination', 'heinous', 'outrageous', 'despicable', 'rot', 'scum'],
      fear: ['deadly', 'danger', 'hazard', 'threat', 'lethal', 'toxic', 'catastrophe', 'peril', 'epidemic', 'fatal', 'poison', 'extinction', 'kill', 'destroy', 'apocalypse', 'annihilation', 'collapse', 'horrifying', 'nightmare', 'blood bath', 'devastation', 'doomsday', 'massacre', 'biohazard', 'panic', 'ruin', 'terror'],
      urgency: ['breaking', 'emergency', 'act now', 'urgent', 'delete', 'warning', 'critical alert', 'share immediately', 'before it is too late', 'rt now', 'immediately', 'panic', 'share before deleted', 'time is running out', 'red alert', 'distribute immediately', 'censored immediately', 'viral now', 'flash bulletin', 'last chance'],
      tribalism: ['patriot', 'traitor', 'enemy within', 'cabal', 'us vs them', 'infiltrator', 'puppet', 'sheep', 'invader', 'foreign agent', 'the enemy', 'they want to destroy us', 'our people', 'true patriots', 'infiltrators', 'puppets', 'elites', 'deep state', 'subversives', 'foreign agents', 'traitors within', 'globalist agenda', 'betrayal of our kind', 'loyalists', 'fifth column'],
      conspiracy: ['coverup', 'deep state', 'hidden agenda', 'secret plot', 'shadow government', 'puppet masters', 'globalist', 'suppressed truth', 'cabal', 'illuminati', 'plot', 'orchestrating', 'orchestrated', 'they are hiding', 'what the media will not tell you', 'clandestine', 'psyop', 'false flag', 'controlled opposition', 'hidden truth', 'engineered crisis', 'mainstream media blackout', 'puppeteer', 'hoax', 'manufactured consensus'],
      fatalism: ['hopeless', 'doomed', 'inevitable collapse', 'pointless', 'corrupted beyond repair', 'decay', 'destruction', 'no future', 'irreversible', 'nothing matters', 'all politicians lie', 'everything is fake', 'democracy is dead', 'futile', 'illusion of choice', 'rigged system', 'surrender', 'unavoidable collapse', 'powerless', 'total fraud']
    },
    fallacyRegexes: [
      { pattern: '\\b(corrupt liar|convicted fraudster|lunatic|idiot|traitor|don\'t listen to him|he is a convicted|he took grant money|he is arrogant|stupid idiot)\\b', fallacyId: 'fallacy-ad-hominem', name: 'Ad Hominem' },
      { pattern: '\\b(he only says that because he owns stock|she stands to profit|paid by the industry|conflict of interest proves|he worked at a pharmaceutical company)\\b', fallacyId: 'fallacy-ad-hominem-circumstantial', name: 'Ad Hominem (Circumstantial)' },
      { pattern: '\\b(either (we|you) .+ or (the entire|all|we are doomed|society will collapse)|either we completely|or our nation will be destroyed|only two choices|you are either with us or|if you don\'t support this policy you hate our country)\\b', fallacyId: 'fallacy-false-dilemma', name: 'False Dilemma' },
      { pattern: '\\b(if we (allow|pass|give) .+ (will inevitably lead to|inevitable collapse|totalitarian)|if we allow this next year they will|first it is compost sorting then imprisonment|first they come for our guns then they put us in camps|inevitable slippery slope)\\b', fallacyId: 'fallacy-slippery-slope', name: 'Slippery Slope' },
      { pattern: '\\b(what about when|whatabout|they did the exact same|how can you criticize|what about when you|you did the exact same thing|hypocrite)\\b', fallacyId: 'fallacy-tu-quoque', name: 'Whataboutism / Tu Quoque' },
      { pattern: '\\b(famous (celebrity|actor|athlete|singer) (confirms|reveals|endorses)|hollywood celebrity says|actor marcus lane insists|famous chef endorses)\\b', fallacyId: 'fallacy-appeal-to-false-authority', name: 'Appeal to False Authority' },
      { pattern: '\\b(think of the (innocent )?children|your family will (starve|die|suffer)|how can you doubt when soldiers are dying|for the love of god)\\b', fallacyId: 'fallacy-appeal-to-fear', name: 'Appeal to Fear & Emotion' },
      { pattern: '\\b(literally wants to ban all|wants to destroy every single|advocates abolishing all)\\b', fallacyId: 'fallacy-straw-man', name: 'Straw Man' },
      { pattern: '\\b(why are we talking about this when|what about the real problem of|distraction from the real issue)\\b', fallacyId: 'fallacy-red-herring', name: 'Red Herring' },
      { pattern: '\\b(80 million people cannot be wrong|over 10 million users bought|everyone is doing it|everyone knows that|it is common knowledge that|no intelligent person would deny)\\b', fallacyId: 'fallacy-appeal-to-popularity', name: 'Appeal to Popularity' },
      { pattern: '\\b(my grandfather smoked every day and lived to 98|my cousin tried it and was cured|I saw it on a telegram group so it must be real|a doctor friend of a friend said)\\b', fallacyId: 'fallacy-anecdotal-evidence', name: 'Anecdotal Evidence' },
      { pattern: '\\b(right after we changed the logo revenue surged|after the vaccine he got a cold so the vaccine caused)\\b', fallacyId: 'fallacy-post-hoc-ergo-propter-hoc', name: 'Post Hoc Ergo Propter Hoc' },
      { pattern: '\\b(look at these three cancer patients near the tower|four consecutive market rallies on full moons)\\b', fallacyId: 'fallacy-texas-sharpshooter', name: 'Texas Sharpshooter' }
    ],
    hedgingMarkers: [
      'allegedly', 'reportedly', 'purportedly', 'it is claimed', 'sources say',
      'rumored to be', 'supposedly', 'it could be argued', 'some might suggest',
      'sources speculate', 'it remains possible that', 'unconfirmed rumors hint',
      'it is said that', 'many people are saying', 'critics claim', 'concerns have been raised'
    ],
    certaintyMarkers: [
      'undeniably', '100% proven', 'indisputable fact', 'absolute certainty',
      'irrefutable truth', 'beyond all doubt', 'categorically proven', 'absolute fact',
      '100% conclusive', 'unquestionably', 'definitive proof'
    ]
  };

  static fallbackSources = [
    { domain: 'reuters.com', name: 'Reuters News Agency', factualityRating: 'Very High', biasRating: 'Center', credibilityScore: 98, admiraltyRating: 'A1', ownership: 'Thomson Reuters Corporation', fundingTransparency: 'High', retractionHistory: { totalRetractions: 14, protocolAdherence: 'Strict', notes: 'Transparent editor notes with timestamped corrections.' } },
    { domain: 'apnews.com', name: 'Associated Press (AP)', factualityRating: 'Very High', biasRating: 'Center', credibilityScore: 98, admiraltyRating: 'A1', ownership: 'Not-for-profit news cooperative', fundingTransparency: 'High', retractionHistory: { totalRetractions: 18, protocolAdherence: 'Strict', notes: 'Gold standard in transparent wire correction protocols.' } },
    { domain: 'afp.com', name: 'Agence France-Presse (AFP)', factualityRating: 'Very High', biasRating: 'Center', credibilityScore: 97, admiraltyRating: 'A1', ownership: 'Autonomous public corporation', fundingTransparency: 'High', retractionHistory: { totalRetractions: 12, protocolAdherence: 'Strict', notes: 'Comprehensive corrections log across multilingual feeds.' } },
    { domain: 'bbc.com', name: 'BBC News', factualityRating: 'Very High', biasRating: 'Center-Left', credibilityScore: 95, admiraltyRating: 'A1', ownership: 'BBC Trust / Royal Charter', fundingTransparency: 'High', retractionHistory: { totalRetractions: 22, protocolAdherence: 'Strict', notes: 'Public corrections and clarifications page.' } },
    { domain: 'bellingcat.com', name: 'Bellingcat Open Source Investigations', factualityRating: 'Very High', biasRating: 'Center', credibilityScore: 96, admiraltyRating: 'A1', ownership: 'Stichting Bellingcat (Non-profit)', fundingTransparency: 'High', retractionHistory: { totalRetractions: 4, protocolAdherence: 'Strict', notes: 'Publishes full methodologies, raw datasets, and tool scripts.' } },
    { domain: 'propublica.org', name: 'ProPublica', factualityRating: 'Very High', biasRating: 'Center-Left', credibilityScore: 96, admiraltyRating: 'A1', ownership: 'Pro Publica, Inc. (501(c)(3) Non-profit)', fundingTransparency: 'High', retractionHistory: { totalRetractions: 8, protocolAdherence: 'Strict', notes: 'Publishes data methodologies and downloadable raw research.' } },
    { domain: 'snopes.com', name: 'Snopes Fact Check', factualityRating: 'Very High', biasRating: 'Center', credibilityScore: 94, admiraltyRating: 'A2', ownership: 'Snopes Media Group Inc.', fundingTransparency: 'High', retractionHistory: { totalRetractions: 31, protocolAdherence: 'Strict', notes: 'Full transparent editorial correction archive.' } },
    { domain: 'politifact.com', name: 'PolitiFact', factualityRating: 'High', biasRating: 'Center-Left', credibilityScore: 93, admiraltyRating: 'A2', ownership: 'Poynter Institute for Media Studies', fundingTransparency: 'High', retractionHistory: { totalRetractions: 28, protocolAdherence: 'Strict', notes: 'IFCN verified signatory with public correction logs.' } },
    { domain: 'factcheck.org', name: 'FactCheck.org', factualityRating: 'Very High', biasRating: 'Center', credibilityScore: 95, admiraltyRating: 'A2', ownership: 'Annenberg Public Policy Center (University of Pennsylvania)', fundingTransparency: 'High', retractionHistory: { totalRetractions: 15, protocolAdherence: 'Strict', notes: 'Academic non-profit fact-checking institute.' } },
    { domain: 'nytimes.com', name: 'The New York Times', factualityRating: 'High', biasRating: 'Center-Left', credibilityScore: 90, admiraltyRating: 'B2', ownership: 'The New York Times Company (Public: NYT)', fundingTransparency: 'High', retractionHistory: { totalRetractions: 64, protocolAdherence: 'Strict', notes: 'Daily published corrections section in print and digital.' } },
    { domain: 'wsj.com', name: 'The Wall Street Journal', factualityRating: 'High', biasRating: 'Center-Right', credibilityScore: 91, admiraltyRating: 'B1', ownership: 'Dow Jones & Company / News Corp', fundingTransparency: 'High', retractionHistory: { totalRetractions: 42, protocolAdherence: 'Strict', notes: 'Rigorous newsroom standards with formal correction logs.' } },
    { domain: 'washingtonpost.com', name: 'The Washington Post', factualityRating: 'High', biasRating: 'Center-Left', credibilityScore: 89, admiraltyRating: 'B2', ownership: 'Nash Holdings (Jeff Bezos)', fundingTransparency: 'Moderate', retractionHistory: { totalRetractions: 55, protocolAdherence: 'Strict', notes: 'Prominent inline correction notices on updated reporting.' } },
    { domain: 'theguardian.com', name: 'The Guardian', factualityRating: 'High', biasRating: 'Left-Center', credibilityScore: 88, admiraltyRating: 'B2', ownership: 'Scott Trust Limited', fundingTransparency: 'High', retractionHistory: { totalRetractions: 48, protocolAdherence: 'Strict', notes: 'Open readers editor column and corrections register.' } },
    { domain: 'lemonde.fr', name: 'Le Monde', factualityRating: 'High', biasRating: 'Center-Left', credibilityScore: 91, admiraltyRating: 'B1', ownership: 'Le Monde Group', fundingTransparency: 'High', retractionHistory: { totalRetractions: 30, protocolAdherence: 'Strict', notes: 'Comprehensive ethics charter and formal corrections policy.' } },
    { domain: 'cnn.com', name: 'CNN (Cable News Network)', factualityRating: 'Mixed', biasRating: 'Left', credibilityScore: 72, admiraltyRating: 'C2', ownership: 'Warner Bros. Discovery', fundingTransparency: 'Moderate', retractionHistory: { totalRetractions: 85, protocolAdherence: 'Moderate', notes: 'Broadcast retractions variable; online corrections logged.' } },
    { domain: 'foxnews.com', name: 'Fox News', factualityRating: 'Mixed', biasRating: 'Right', credibilityScore: 68, admiraltyRating: 'C3', ownership: 'Fox Corporation (Murdoch family)', fundingTransparency: 'Moderate', retractionHistory: { totalRetractions: 92, protocolAdherence: 'Moderate', notes: 'High distinction between daytime news and opinion programming.' } },
    { domain: 'dailymail.co.uk', name: 'Daily Mail / MailOnline', factualityRating: 'Low', biasRating: 'Right', credibilityScore: 45, admiraltyRating: 'D4', ownership: 'Daily Mail and General Trust (DMGT)', fundingTransparency: 'Moderate', retractionHistory: { totalRetractions: 160, protocolAdherence: 'Low', notes: 'Frequent IPSO press standard adjudications and retractions.' } },
    { domain: 'tass.com', name: 'TASS Russian News Agency', factualityRating: 'Low', biasRating: 'State-Controlled', credibilityScore: 35, admiraltyRating: 'D4', ownership: 'Government of the Russian Federation', fundingTransparency: 'Low', retractionHistory: { totalRetractions: 10, protocolAdherence: 'Low', notes: 'State media alignment; retractions follow government directives.' } },
    { domain: 'globaltimes.cn', name: 'Global Times', factualityRating: 'Low', biasRating: 'State-Controlled', credibilityScore: 32, admiraltyRating: 'D4', ownership: 'People\'s Daily / CCP Central Committee', fundingTransparency: 'Low', retractionHistory: { totalRetractions: 5, protocolAdherence: 'Low', notes: 'Official state editorial megaphone; zero independent correction mechanism.' } },
    { domain: 'rt.com', name: 'RT (Russia Today)', factualityRating: 'Very Low', biasRating: 'State-Controlled', credibilityScore: 20, admiraltyRating: 'E5', ownership: 'ANO TV-Novosti (Russian Federal State)', fundingTransparency: 'Very Low', retractionHistory: { totalRetractions: 6, protocolAdherence: 'Very Low', notes: 'Demonstrated state propaganda outlet with extensive disinformation records.' } },
    { domain: 'sputniknews.com', name: 'Sputnik News', factualityRating: 'Very Low', biasRating: 'State-Controlled', credibilityScore: 18, admiraltyRating: 'E5', ownership: 'Rossiya Segodnya (Russian State)', fundingTransparency: 'Very Low', retractionHistory: { totalRetractions: 3, protocolAdherence: 'Very Low', notes: 'State information warfare organ; opaque editorial governance.' } },
    { domain: 'breitbart.com', name: 'Breitbart News', factualityRating: 'Very Low', biasRating: 'Far-Right', credibilityScore: 25, admiraltyRating: 'E5', ownership: 'Breitbart News Network LLC', fundingTransparency: 'Low', retractionHistory: { totalRetractions: 40, protocolAdherence: 'Low', notes: 'Hyperpartisan editorial stance with numerous uncorrected conspiracy assertions.' } },
    { domain: 'thegrayzone.com', name: 'The Grayzone', factualityRating: 'Low', biasRating: 'Far-Left / Pro-Authoritarian', credibilityScore: 28, admiraltyRating: 'E5', ownership: 'Independent / Max Blumenthal', fundingTransparency: 'Very Low', retractionHistory: { totalRetractions: 2, protocolAdherence: 'Very Low', notes: 'Systematic apologetics for authoritarian states and denial of human rights documentation.' } },
    { domain: 'infowars.com', name: 'InfoWars', factualityRating: 'Very Low', biasRating: 'Conspiracy / Far-Right', credibilityScore: 5, admiraltyRating: 'F6', ownership: 'Free Speech Systems LLC (Alex Jones)', fundingTransparency: 'None', retractionHistory: { totalRetractions: 0, protocolAdherence: 'None', notes: 'Defamation judgments for mass-casualty false flag hoaxes; zero corrections protocol.' } }
  ];

  static fallbackFallacies = [
    { id: 'fallacy-ad-hominem', name: 'Ad Hominem', latinName: 'Argumentum ad Hominem', category: 'Relevance & Distraction', definition: 'Attacking personal character rather than substantive merits of the claim.', psychologicalVector: 'Triggers affective disgust and tribal rejection to bypass prefrontal scrutiny.' },
    { id: 'fallacy-ad-hominem-circumstantial', name: 'Ad Hominem (Circumstantial)', latinName: 'Argumentum ad Hominem Circumstantiae', category: 'Relevance & Distraction', definition: 'Dismissing arguments based on perceived personal interest or affiliation.', psychologicalVector: 'Exploits cynicism and suspicion of vested interests to invalidate sound premises.' },
    { id: 'fallacy-false-dilemma', name: 'False Dilemma', latinName: 'Tertium Non Datur / Bifurcatio', category: 'Structural & Logical', definition: 'Forcing a false binary choice between extreme alternatives while ignoring nuanced spectrums.', psychologicalVector: 'Manufactures artificial urgency and crisis by eliminating moderate alternatives.' },
    { id: 'fallacy-slippery-slope', name: 'Slippery Slope', latinName: 'Secundum Quid / Abusus Non Tollit Usum', category: 'Causal & Extrapolation', definition: 'Asserting an initial action triggers an inevitable catastrophic chain of events without causal proof.', psychologicalVector: 'Leverages catastrophic dread to block incremental policy consideration.' },
    { id: 'fallacy-tu-quoque', name: 'Whataboutism / Tu Quoque', latinName: 'Tu Quoque', category: 'Relevance & Distraction', definition: 'Deflecting criticism by accusing the opponent of hypocrisy.', psychologicalVector: 'Neutralizes ethical scrutiny through moral equivalence and cynical distraction.' },
    { id: 'fallacy-appeal-to-false-authority', name: 'Appeal to False Authority', latinName: 'Argumentum ad Verecundiam', category: 'Appeals & Authority', definition: 'Citing an unqualified or irrelevant authority figure to substantiate empirical claims.', psychologicalVector: 'Transfers halo effect and prestige from unrelated domains to manufacture credibility.' },
    { id: 'fallacy-appeal-to-fear', name: 'Appeal to Fear & Emotion', latinName: 'Argumentum ad Metum', category: 'Emotional & Affective', definition: 'Instilling panic or existential dread to force irrational assent.', psychologicalVector: 'Hijacks the amygdala to disable critical deliberative faculties.' },
    { id: 'fallacy-straw-man', name: 'Straw Man', latinName: 'Argumentum in Fabulam', category: 'Relevance & Distortion', definition: 'Caricaturing an opposing position to make it easier to attack.', psychologicalVector: 'Provides cognitive gratification by defeating an artificially weak opponent.' },
    { id: 'fallacy-red-herring', name: 'Red Herring', latinName: 'Ignoratio Elenchi', category: 'Relevance & Distraction', definition: 'Introducing an irrelevant topic to divert attention from core evidence.', psychologicalVector: 'Exploits working memory limits to derail analytical focus.' },
    { id: 'fallacy-appeal-to-popularity', name: 'Appeal to Popularity', latinName: 'Argumentum ad Populum', category: 'Appeals & Consensus', definition: 'Asserting a claim is true because a large group believes or adopts it.', psychologicalVector: 'Exploits social proof and the fear of isolation.' },
    { id: 'fallacy-anecdotal-evidence', name: 'Anecdotal Evidence', latinName: 'Testimonium Singulare', category: 'Evidential & Scope', definition: 'Using isolated personal stories instead of controlled empirical datasets.', psychologicalVector: 'Narrative vividness overpowers statistical comprehension.' },
    { id: 'fallacy-post-hoc-ergo-propter-hoc', name: 'Post Hoc Ergo Propter Hoc', latinName: 'Post Hoc Ergo Propter Hoc', category: 'Causal & Temporal', definition: 'Assuming chronological succession implies causal relationship.', psychologicalVector: 'Brain hardwiring for causal attribution creates illusory correlations.' },
    { id: 'fallacy-texas-sharpshooter', name: 'Texas Sharpshooter', latinName: 'Cluster Illusion', category: 'Statistical & Confirmation', definition: 'Cherry-picking data clusters while ignoring the broader distribution.', psychologicalVector: 'Pattern-seeking reflex finds artificial significance in random noise.' }
  ];

  /**
   * Extract domains and URLs from raw text.
   * Matches both full URLs (http/https) and bare domains.
   * @param {string} text
   * @returns {string[]}
   */
  static extractDomains(text = '') {
    if (!text || typeof text !== 'string') return [];
    const domains = new Set();

    // 1. Match full URLs (http/https)
    const urlRegex = /https?:\/\/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)(?::\d+)?(?:\/[^\s)\]>"',;]*)?/gi;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      if (match[1]) {
        const d = match[1].toLowerCase().replace(/^www\./, '').replace(/[:\/].*$/, '').replace(/[.,!?;:]+$/, '');
        if (d.includes('.')) domains.add(d);
      }
    }

    // 2. Match standalone domains (e.g. reuters.com, rt.com, bbc.co.uk, apnews.com, etc.)
    const nonDomainExts = new Set([
      // File extensions & data formats
      'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'eps',
      'mp3', 'mp4', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'avi', 'mov', 'mkv', 'webm',
      'txt', 'pdf', 'json', 'js', 'mjs', 'cjs', 'html', 'htm', 'css', 'scss', 'sass', 'less',
      'ts', 'tsx', 'jsx', 'md', 'mdx', 'py', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'java', 'rb', 'php',
      'zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xml', 'csv', 'tsv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'exe', 'bin', 'dat', 'log', 'env', 'yml', 'yaml', 'toml', 'ini', 'sh', 'bat', 'ps1', 'map', 'wasm',
      // Common programming / object properties & methods
      'property', 'properties', 'length', 'tostring', 'value', 'values', 'name', 'names',
      'target', 'targets', 'source', 'sources', 'type', 'types', 'prototype', 'constructor',
      'index', 'indexes', 'indices', 'key', 'keys', 'item', 'items', 'id', 'ids',
      'config', 'options', 'params', 'data', 'state', 'result', 'results', 'error', 'errors',
      'status', 'count', 'default', 'fn', 'func', 'function', 'get', 'set', 'class',
      'return', 'const', 'let', 'var', 'import', 'export', 'from', 'method', 'methods',
      'style', 'styles', 'width', 'height', 'top', 'left', 'right', 'bottom', 'size',
      'child', 'children', 'parent', 'node', 'nodes', 'element', 'elements', 'tag', 'tags',
      'text', 'content', 'match', 'matches', 'split', 'join', 'push', 'pop', 'slice', 'splice',
      'reduce', 'filter', 'foreach', 'find', 'indexof', 'includes', 'some', 'every', 'sort',
      'concat', 'replace', 'charat', 'charcodeat', 'tolowercase', 'touppercase', 'trim',
      'hasownproperty', 'valueof', 'bind', 'call', 'apply', 'entries', 'assign', 'create',
      'seal', 'freeze', 'defined', 'undefined', 'null', 'true', 'false',
      'then', 'catch', 'finally', 'resolve', 'reject', 'all', 'race', 'allsettled', 'any'
    ]);

    const domainRegex = /\b([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)*\.[a-zA-Z]{2,63})\b/gi;
    while ((match = domainRegex.exec(text)) !== null) {
      if (match[1]) {
        const d = match[1].toLowerCase().replace(/^www\./, '').replace(/[.,!?;:]+$/, '');
        const tld = d.split('.').pop();
        if (d.includes('.') && !nonDomainExts.has(tld)) {
          domains.add(d);
        }
      }
    }

    return Array.from(domains);
  }

  /**
   * Get human-readable description for Admiralty Intelligence Ratings (A1..F6).
   * @param {string} rating
   * @returns {string}
   */
  static getAdmiraltyDescription(rating = '') {
    const code = (rating || '').toUpperCase().trim();
    const map = {
      'A1': 'Completely Reliable — Confirmed by independent wire / peer-reviewed consensus',
      'A2': 'Completely Reliable — Probably True (Certified Fact-Checker / Institutional Record)',
      'B1': 'Usually Reliable — Confirmed by established news agency',
      'B2': 'Usually Reliable — Probably True (Established National Newspaper of Record)',
      'C2': 'Fairly Reliable — Probably True',
      'C3': 'Fairly Reliable — Possibly True (Commercial News / Opinion Hybrid)',
      'D4': 'Not Usually Reliable — Doubtful (Tabloid / Partisan Outlet)',
      'E5': 'Unreliable — Improbable (State Propaganda / Hyperpartisan Vector)',
      'F6': 'Reliability Cannot Be Judged — Truth Cannot Be Judged (Anonymous / Unverified)'
    };
    return map[code] || 'Uncalibrated Intelligence Rating';
  }

  /**
   * Match extracted domains against the source database.
   * @param {string[]} domains
   * @param {Array<object>|null} sourcesData
   * @returns {Array<object>}
   */
  static matchSources(domains = [], sourcesData = null) {
    const db = Array.isArray(sourcesData) && sourcesData.length > 0
      ? sourcesData
      : (Array.isArray(this.sourcesDatabase) && this.sourcesDatabase.length > 0 ? this.sourcesDatabase : this.fallbackSources);

    const domainList = Array.isArray(domains) ? domains : [];

    if (domainList.length === 0) {
      return [{
        domain: null,
        source: null,
        name: 'Anonymous / Uncorroborated Source',
        factuality: 'Unverified',
        bias: 'Unknown',
        credibilityScore: 30,
        admiraltyRating: 'F6',
        admiraltyDescription: this.getAdmiraltyDescription('F6'),
        ownership: 'Anonymous Origin',
        fundingTransparency: 'None',
        retractionHistory: null,
        matched: false
      }];
    }

    return domainList.map(domain => {
      const cleanDomain = (domain || '').toLowerCase().trim();
      const match = db.find(s => {
        if (!s.domain) return false;
        const sDom = s.domain.toLowerCase();
        return sDom === cleanDomain ||
               cleanDomain.endsWith('.' + sDom) ||
               sDom.endsWith('.' + cleanDomain);
      });

      if (match) {
        return {
          domain: match.domain || cleanDomain,
          source: match,
          name: match.name || match.domain,
          factuality: match.factualityRating || 'Mixed',
          bias: match.biasRating || 'Center',
          credibilityScore: typeof match.credibilityScore === 'number' ? match.credibilityScore : 50,
          admiraltyRating: match.admiraltyRating || 'C3',
          admiraltyDescription: this.getAdmiraltyDescription(match.admiraltyRating || 'C3'),
          ownership: match.ownership || 'Corporate / Private',
          fundingTransparency: match.fundingTransparency || 'Moderate',
          retractionHistory: match.retractionHistory || null,
          matched: true
        };
      }

      return {
        domain: cleanDomain,
        source: null,
        name: `Unindexed External Domain (${cleanDomain})`,
        factuality: 'Unverified',
        bias: 'Unknown',
        credibilityScore: 40,
        admiraltyRating: 'F6',
        admiraltyDescription: this.getAdmiraltyDescription('F6'),
        ownership: 'Unknown / Unregistered',
        fundingTransparency: 'Unknown',
        retractionHistory: null,
        matched: false
      };
    });
  }

  /**
   * Helper to retrieve Latin nomenclature and psychological vector explanation for fallacies.
   */
  static getFallacyMeta(fallacyId, name = '', fallaciesData = null) {
    const db = Array.isArray(fallaciesData) && fallaciesData.length > 0
      ? fallaciesData
      : (Array.isArray(this.fallaciesDatabase) && this.fallaciesDatabase.length > 0 ? this.fallaciesDatabase : this.fallbackFallacies);

    const cleanId = (fallacyId || '').toLowerCase().trim();
    const cleanName = (name || '').toLowerCase().trim();

    const matched = db.find(f => {
      const fId = (f.id || '').toLowerCase();
      const fName = (f.name || '').toLowerCase();
      return fId === cleanId ||
             (cleanId && (fId.startsWith(cleanId) || cleanId.startsWith(fId))) ||
             (cleanName && fName === cleanName) ||
             (cleanName && (fName.includes(cleanName) || cleanName.includes(fName)));
    });

    if (matched) {
      return {
        name: matched.name || name || 'Logical Fallacy',
        latin: matched.latinName || 'Argumentum ad Hominem',
        category: matched.category || 'Relevance & Distraction',
        explanation: matched.definition || matched.psychologicalVector || 'Structural flaw in argument formulation.'
      };
    }

    // Fallback defaults by ID or name
    const defaults = {
      'fallacy-ad-hominem': { name: 'Ad Hominem', latin: 'Argumentum ad Hominem', category: 'Relevance & Distraction', explanation: 'Attacks personal character rather than substantive merits.' },
      'fallacy-ad-hominem-abusive': { name: 'Ad Hominem (Abusive)', latin: 'Argumentum ad Hominem', category: 'Relevance & Distraction', explanation: 'Attacks personal character rather than substantive merits.' },
      'fallacy-ad-hominem-circumstantial': { name: 'Ad Hominem (Circumstantial)', latin: 'Argumentum ad Hominem Circumstantiae', category: 'Relevance & Distraction', explanation: 'Dismisses claims based on perceived financial or demographic circumstance.' },
      'fallacy-false-dilemma': { name: 'False Dilemma', latin: 'Tertium Non Datur / Bifurcatio', category: 'Structural & Logical', explanation: 'Forces a false binary choice between extreme alternatives.' },
      'fallacy-slippery-slope': { name: 'Slippery Slope', latin: 'Secundum Quid / Abusus Non Tollit Usum', category: 'Causal & Extrapolation', explanation: 'Asserts an initial action triggers an inevitable catastrophic chain of events.' },
      'fallacy-tu-quoque': { name: 'Whataboutism / Tu Quoque', latin: 'Tu Quoque', category: 'Relevance & Distraction', explanation: 'Deflects criticism by accusing the opponent of hypocrisy.' },
      'fallacy-appeal-to-false-authority': { name: 'Appeal to False Authority', latin: 'Argumentum ad Verecundiam', category: 'Appeals & Authority', explanation: 'Cites an unqualified or irrelevant authority figure.' },
      'fallacy-appeal-to-fear': { name: 'Appeal to Fear & Emotion', latin: 'Argumentum ad Metum', category: 'Emotional & Affective', explanation: 'Instills panic or existential dread to force irrational assent.' },
      'fallacy-appeal-to-emotion': { name: 'Appeal to Emotion', latin: 'Argumentum ad Passiones', category: 'Emotional & Affective', explanation: 'Exploits intense emotion to bypass critical verification.' },
      'fallacy-straw-man': { name: 'Straw Man', latin: 'Argumentum in Fabulam', category: 'Relevance & Distortion', explanation: 'Caricatures the opposing argument to make it easier to attack.' },
      'fallacy-red-herring': { name: 'Red Herring', latin: 'Ignoratio Elenchi', category: 'Relevance & Distraction', explanation: 'Introduces an irrelevant topic to divert attention from core evidence.' },
      'fallacy-begging-the-question': { name: 'Begging the Question', latin: 'Petitio Principii', category: 'Structural & Circular', explanation: 'Assumes the truth of the conclusion in the premise.' },
      'fallacy-circular-reasoning': { name: 'Circular Reasoning', latin: 'Circulus in Probando', category: 'Structural & Circular', explanation: 'Reasoning loops back to its initial premise without external proof.' },
      'fallacy-hasty-generalization': { name: 'Hasty Generalization', latin: 'Secundum Quid', category: 'Inductive & Scope', explanation: 'Draws a sweeping universal conclusion from an unrepresentative sample.' },
      'fallacy-texas-sharpshooter': { name: 'Texas Sharpshooter', latin: 'Cluster Illusion', category: 'Statistical & Confirmation', explanation: 'Cherry-picks data clusters while ignoring the broader distribution.' },
      'fallacy-anecdotal-evidence': { name: 'Anecdotal Evidence', latin: 'Testimonium Singulare', category: 'Evidential & Scope', explanation: 'Relies on isolated personal anecdotes rather than controlled empirical trials.' },
      'fallacy-post-hoc-ergo-propter-hoc': { name: 'Post Hoc Ergo Propter Hoc', latin: 'Post Hoc Ergo Propter Hoc', category: 'Causal & Temporal', explanation: 'Assumes chronological succession implies causation.' }
    };

    const def = defaults[cleanId] || Object.values(defaults).find(d => d.name.toLowerCase() === cleanName);
    if (def) return def;

    return {
      name: name || 'Logical Fallacy',
      latin: 'Non Sequitur',
      category: 'Informal Fallacy',
      explanation: 'Logical gap between premises and stated conclusion.'
    };
  }

  /**
   * Generates 3 weaponized manipulative reframings (Outrage Maximizer, False Consensus, In-Group Threat)
   * for active cognitive inoculation drills.
   * @param {string} claimText
   * @param {object|null} analysis
   * @returns {object}
   */
  static generateAdversarialReframings(claimText = '', analysis = null) {
    const text = (claimText || '').trim();
    const words = text.split(/\s+/).filter(w => w.length > 3);
    const topic = words.slice(0, 4).join(' ') || 'the reported event';

    return {
      outrageMaximizer: {
        vector: 'outrageMaximizer',
        name: 'Outrage Maximizer',
        badge: 'Affective Moral Vilification',
        headline: `CORRUPT BETRAYAL: Heinous Atrocity and Treasonous Criminal Coverup!`,
        text: `SHAMEFUL OUTRAGE: Corrupt bureaucrats and treasonous officials have committed an unforgivable betrayal regarding ${topic}! This depraved scandal proves the system is completely rotten and criminal to the core!`,
        targetedVulnerability: 'Moral Outrage & Affective Blame Attribution (System 1 Affect Heuristic)',
        countermeasure: 'Separate loaded moral adjectives from verifiable physical telemetry; demand primary empirical logs.',
        skillIds: ['skill.tactic.emotive-framing', 'skill.fallacy.appeals'],
        vulnerabilityOptions: [
          'Moral Outrage & Affective Blame Attribution (System 1 Affect Heuristic)',
          'Base-Rate Fallacy in Sample Distributions',
          'Availability Cascade via Media Saturation',
          'Sunk-Cost Cognitive Commitment'
        ],
        correctVulnerabilityIndex: 0,
        counterBriefOptions: [
          'Optimal Inoculation: Strip all emotive moral adjectives and evaluate whether physical records or verified audit filings substantiate the underlying claim.',
          'Escalation: Accuse the author of being even more corrupt to neutralize their moral high ground.',
          'Apathy: Assume all institutions are hopelessly broken so evidence does not matter.'
        ],
        correctBriefIndex: 0
      },
      falseConsensus: {
        vector: 'falseConsensus',
        name: 'False Consensus',
        badge: 'Astroturfed Bandwagon',
        headline: `OVERWHELMING CONSENSUS: Millions of Citizens and 100% of Independent Experts Agree!`,
        text: `EVERYONE AGREES: Millions of intelligent citizens and 100% of top independent scientists have already confirmed the truth regarding ${topic}. Over 10 million people are demanding immediate action—no rational person can deny this undeniable consensus!`,
        targetedVulnerability: 'Bandwagon Effect & Astroturfed Social Consensus',
        countermeasure: 'Audit botnet traffic and coordination metrics; demand transparent sampling methodology rather than raw volume claims.',
        skillIds: ['skill.tactic.astroturfing', 'skill.fallacy.appeals'],
        vulnerabilityOptions: [
          'Bandwagon Effect & Astroturfed Social Consensus',
          'Anthropomorphic Agency Projection',
          'Fundamental Attribution Error in Behavior',
          'Hyperbolic Temporal Discounting'
        ],
        correctVulnerabilityIndex: 0,
        counterBriefOptions: [
          'Optimal Inoculation: Demand peer-reviewed methodology and statistical variance. Verify whether volume reflects organic consensus or synthetic algorithmic bot coordination.',
          'Conformity: Accept the conclusion because a large majority cannot be mistaken.',
          'Celebrity Appeal: Find a popular celebrity who opposes the consensus to refute it.'
        ],
        correctBriefIndex: 0
      },
      inGroupThreat: {
        vector: 'inGroupThreat',
        name: 'In-Group Threat',
        badge: 'Tribal Siege Mentality',
        headline: `EXISTENTIAL THREAT: Hostile Foreign Infiltrators Attack Our People and Heritage!`,
        text: `CRITICAL TRIBAL ALERT: Hostile outside enemies and fifth-column infiltrators are plotting the destruction of our people through ${topic}! They want to erase our heritage and subjugate our families—true loyal patriots must unite against the subversives within!`,
        targetedVulnerability: 'In-Group Favoritism & Tribal Siege Mentality',
        countermeasure: 'Decouple factual veracity from identity threat; evaluate the empirical claim independently of out-group demonization.',
        skillIds: ['skill.bias.attribution', 'skill.tactic.emotive-framing'],
        vulnerabilityOptions: [
          'In-Group Favoritism & Tribal Siege Mentality',
          'Anchoring on Initial Numerical Estimates',
          'Gambler\'s Fallacy in Independent Events',
          'Illusory Truth via Familiarity Exposure'
        ],
        correctVulnerabilityIndex: 0,
        counterBriefOptions: [
          'Optimal Inoculation: Decouple the factual assertion from existential identity fears. Evaluate the telemetry objectively without attributing conspiratorial intent to out-groups.',
          'Tribal Fortification: Sever communication with anyone outside our group to protect group purity.',
          'Counter-Accusation: Claim the outside group is secretly attacking their own members.'
        ],
        correctBriefIndex: 0
      }
    };
  }

  /**
   * Runs offline heuristic NLP analysis against rules dataset.
   * Produces structured 5-step Epistemic Chain-of-Thought Dialectic object.
   */
  static runOfflineHeuristics(text = '', rules = this.defaultRules, sourcesData = null, fallaciesData = null) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      const anonymousSource = this.matchSources([], sourcesData)[0];
      return {
        claimText: '',
        veracityScore: 50,
        manipulationRisk: 0,
        credibilityTier: 'Neutral / Insufficient Data',
        isLiveApi: false,
        step1_affect: {
          outrage: 0, fear: 0, urgency: 0, tribalism: 0, conspiracy: 0, fatalism: 0,
          dominantVector: null,
          triggeredKeywords: { outrage: [], fear: [], urgency: [], tribalism: [], conspiracy: [], fatalism: [] }
        },
        step2_fallacies: [],
        step3_epistemics: {
          hedgingRatio: 0,
          certaintyInflation: 0,
          wordCount: 0,
          readingLevel: 'Neutral / Insufficient Data',
          hedgingMatches: [],
          certaintyMatches: []
        },
        step4_sources: [anonymousSource],
        step5_synthesis: {
          manipulationRisk: 0,
          veracityScore: 50,
          recommendation: 'share',
          verdictClass: 'plausible',
          rationale: 'No text provided for epistemic forensics audit.',
          prebunkBrief: 'Insufficient claim text to evaluate veracity or deception risk.',
          keyFlags: []
        },
        emotionalTriggers: { outrage: 0, fear: 0, urgency: 0, tribalism: 0, conspiracy: 0, fatalism: 0 },
        detectedFallacies: [],
        epistemicMetrics: { hedgingRatio: 0, certaintyInflation: 0, wordCount: 0 },
        biasIndicators: [],
        confidence: 50,
        sources: ['Offline Heuristic Rule Engine (Ruleset v1.0)'],
        reasoning: 'No text provided for analysis.',
        prebunkSummary: 'Insufficient claim text to evaluate veracity.'
      };
    }

    const lowerText = cleanText.toLowerCase();
    const words = lowerText.match(/[a-z0-9'-]+/gi) || [];
    const wordCount = Math.max(1, words.length);

    // 1. Calculate Emotional Trigger Intensities (0..100)
    const emoScores = {};
    const triggeredKeywords = {};
    const lexicons = rules.emotionalLexicons || this.defaultRules.emotionalLexicons;
    for (const [vec, list] of Object.entries(lexicons)) {
      let hits = 0;
      triggeredKeywords[vec] = [];
      for (const kw of list) {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          hits += matches.length;
          if (!triggeredKeywords[vec].includes(kw)) {
            triggeredKeywords[vec].push(kw);
          }
        }
      }
      let intensity = 0;
      if (hits > 0) {
        intensity = Math.min(100, Math.round((hits * 55) + ((hits / wordCount) * 120)));
      }
      emoScores[vec] = intensity;
    }

    let dominantVector = null;
    let maxEmo = 0;
    for (const [vec, score] of Object.entries(emoScores)) {
      if (score > maxEmo) {
        maxEmo = score;
        dominantVector = vec;
      }
    }

    const step1_affect = {
      ...emoScores,
      dominantVector,
      triggeredKeywords
    };

    // 2. Fallacy Pattern Detection with quote extraction
    const detectedFallacies = [];
    const fallacyRules = rules.fallacyRegexes || this.defaultRules.fallacyRegexes;
    for (const f of fallacyRules) {
      try {
        const reg = new RegExp(f.pattern, 'i');
        const match = reg.exec(cleanText);
        if (match) {
          const meta = this.getFallacyMeta(f.fallacyId, f.name, fallaciesData);
          detectedFallacies.push({
            fallacyId: f.fallacyId,
            name: f.name || meta.name || 'Logical Fallacy',
            latin: meta.latin,
            quote: match[0],
            explanation: meta.explanation,
            confidence: f.confidence ?? 0.85,
            category: meta.category
          });
        }
      } catch {}
    }

    const step2_fallacies = detectedFallacies;

    // 3. Epistemic Metrics (Hedging vs Certainty)
    const hedgingMatches = [];
    let hedgingCount = 0;
    for (const h of (rules.hedgingMarkers || this.defaultRules.hedgingMarkers)) {
      const reg = new RegExp(`\\b${h}\\b`, 'gi');
      const matches = lowerText.match(reg);
      if (matches) {
        hedgingCount += matches.length;
        if (!hedgingMatches.includes(h)) hedgingMatches.push(h);
      }
    }

    const certaintyMatches = [];
    let certaintyCount = 0;
    for (const c of (rules.certaintyMarkers || this.defaultRules.certaintyMarkers)) {
      const reg = new RegExp(`\\b${c}\\b`, 'gi');
      const matches = lowerText.match(reg);
      if (matches) {
        certaintyCount += matches.length;
        if (!certaintyMatches.includes(c)) certaintyMatches.push(c);
      }
    }

    const hedgingRatio = Math.min(1.0, Math.round((hedgingCount / Math.max(10, wordCount)) * 100) / 100);
    const certaintyInflation = Math.min(100, certaintyCount * 25);

    let readingLevel = 'Declarative / Standard Calibration';
    if (certaintyInflation >= 50) {
      readingLevel = 'Dogmatic / Polarized Assertions';
    } else if (hedgingRatio >= 0.08) {
      readingLevel = 'Analytic / Qualified Attribution';
    } else if (wordCount < 15) {
      readingLevel = 'Brief / Unelaborated Statement';
    }

    const step3_epistemics = {
      hedgingRatio,
      certaintyInflation,
      wordCount,
      readingLevel,
      hedgingMatches,
      certaintyMatches
    };

    // 4. Source Credibility & Factuality Corroboration
    const extractedDomains = this.extractDomains(cleanText);
    const step4_sources = this.matchSources(extractedDomains, sourcesData);

    // 5. Composite Manipulation Risk Score (0..100) & Synthesis
    const maxEmotion = Math.max(...Object.values(emoScores), 0);
    const avgEmotion = Object.values(emoScores).reduce((a, b) => a + b, 0) / 6;
    const fallacyScore = Math.min(100, detectedFallacies.length * 25);

    let manipulationRisk = 0;
    if (maxEmotion >= 50) {
      manipulationRisk = Math.min(100, Math.round(
        (0.85 * maxEmotion) +
        (0.35 * avgEmotion) +
        (0.35 * fallacyScore) +
        (0.20 * certaintyInflation)
      ));
    } else if (maxEmotion > 0 || fallacyScore > 0 || certaintyInflation > 0) {
      manipulationRisk = Math.min(100, Math.round(
        (0.45 * maxEmotion) +
        (0.25 * avgEmotion) +
        (0.25 * fallacyScore) +
        (0.15 * certaintyInflation)
      ));
    }

    // Source intelligence rating calibration
    const primarySource = step4_sources[0];
    if (primarySource && primarySource.matched && primarySource.admiraltyRating === 'A1' && manipulationRisk < 30) {
      manipulationRisk = Math.max(0, manipulationRisk - 10);
    }

    const veracityScore = Math.max(5, Math.min(95, 100 - manipulationRisk));

    let credibilityTier = 'High Credibility / Low Manipulation';
    if (manipulationRisk >= 75) credibilityTier = 'Critical Epistemic Threat';
    else if (manipulationRisk >= 50) credibilityTier = 'High Manipulation Risk';
    else if (manipulationRisk >= 25) credibilityTier = 'Moderate Caution';

    const recommendation = manipulationRisk >= 70 ? 'block' : manipulationRisk >= 40 ? 'caution' : 'share';
    const verdictClass = recommendation === 'block' ? 'unreliable' : recommendation === 'caution' ? 'unverified' : 'plausible';

    const keyFlags = [];
    if (step1_affect.outrage >= 50) keyFlags.push('Affective Outrage Framing');
    if (step1_affect.urgency >= 50) keyFlags.push('Cognitive Urgency Pressure');
    if (step1_affect.fear >= 50) keyFlags.push('Existential Fear Vector');
    if (step1_affect.conspiracy >= 50) keyFlags.push('Conspiratorial Agency Attribution');
    if (step1_affect.tribalism >= 50) keyFlags.push('Tribal In-Group Hostility');
    if (detectedFallacies.length > 0) keyFlags.push(`${detectedFallacies.length} Fallacy Pattern${detectedFallacies.length === 1 ? '' : 's'}`);
    if (certaintyInflation >= 50) keyFlags.push('Certainty Inflation');
    if (primarySource && !primarySource.matched) keyFlags.push('Unverified / Anonymous Origin');

    let rationale = `Multi-vector epistemic audit classified this assertion as ${credibilityTier} (Manipulation Risk: ${manipulationRisk}%). `;
    if (dominantVector && maxEmotion >= 40) {
      rationale += `Linguistic affect shows dominant ${dominantVector.toUpperCase()} pressure (${maxEmotion}% intensity). `;
    }
    if (detectedFallacies.length > 0) {
      rationale += `Detected ${detectedFallacies.length} structural rhetorical defect(s): ${detectedFallacies.map(f => f.name).join(', ')}. `;
    }
    if (primarySource && primarySource.matched) {
      rationale += `Source attribution linked to ${primarySource.name} (Admiralty Rating: ${primarySource.admiraltyRating}, Factuality: ${primarySource.factuality}). `;
    } else {
      rationale += `Source attribution indicates uncorroborated provenance (Admiralty Rating: F6). `;
    }

    let prebunkBrief = '';
    if (manipulationRisk >= 70) {
      prebunkBrief = `Unverified claim exhibits high emotional manipulation (${dominantVector || 'affective'} pressure) and structural fallacies (${detectedFallacies.map(f => f.name).join(', ') || 'unsubstantiated'}). Do not amplify.`;
    } else if (manipulationRisk >= 40) {
      prebunkBrief = `Caution: Claim relies on speculative qualifiers and unconfirmed source attribution. Independent primary verification required before dissemination.`;
    } else {
      prebunkBrief = `Factual reporting pattern consistent with empirical benchmarks and verified source attribution.`;
    }

    const step5_synthesis = {
      manipulationRisk,
      veracityScore,
      recommendation,
      verdictClass,
      rationale,
      prebunkBrief,
      keyFlags
    };

    return {
      claimText: cleanText,
      veracityScore,
      manipulationRisk,
      credibilityTier,
      isLiveApi: false,
      step1_affect,
      step2_fallacies,
      step3_epistemics,
      step4_sources,
      step5_synthesis,

      // Backwards-compatible aliases:
      emotionalTriggers: emoScores,
      detectedFallacies,
      epistemicMetrics: {
        hedgingRatio,
        certaintyInflation,
        wordCount
      },
      biasIndicators: keyFlags.length > 0 ? keyFlags : ['Neutral / Objective Syntax'],
      confidence: Math.max(60, Math.round(95 - manipulationRisk / 2)),
      sources: ['Offline Heuristic Rule Engine (Ruleset v1.0)', ...step4_sources.map(s => s.name || s.domain).filter(Boolean)],
      reasoning: rationale,
      prebunkSummary: prebunkBrief
    };
  }

  /**
   * Public analyzeClaim method supporting BYOK Gemini API with offline fallback.
   */
  static async analyzeClaim(text, options = { apiKey: null, mode: 'auto' }) {
    const mode = options.mode || 'auto';
    const apiKey = options.apiKey;

    if (mode === 'offline' || !apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return this.runOfflineHeuristics(text);
    }

    try {
      return await this.queryGeminiApi(text, apiKey, options.model);
    } catch {
      const fallbackResult = this.runOfflineHeuristics(text);
      return {
        ...fallbackResult,
        biasIndicators: ['API Fallback: Local NLP Engine Active'],
        confidence: 70,
        sources: ['Offline Heuristic Fallback'],
        reasoning: 'Live API query was bypassed/failed; seamless offline heuristic analysis was applied.',
        isLiveApi: false
      };
    }
  }

  /**
   * Query the Gemini API. Injectable transport: tests pass a stub via
   * `VerdadEngine.fetchImpl` rather than relying on a magic API key that the
   * production code would have to recognise.
   */
  static async queryGeminiApi(text, apiKey, model = 'gemini-2.0-flash') {
    // Allowlist: the model is interpolated into the URL path, so only values the
    // settings modal itself offers may pass through.
    const ALLOWED_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    const chosen = ALLOWED_MODELS.includes(model) ? model : 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosen)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const prompt = `You are VERDAD, an epistemic defense AI engine. Analyze the following assertion for truthfulness, manipulation risk, emotional triggers, logical fallacies, and factual basis.
Claim: "${text}"

Respond ONLY with a valid JSON object matching this schema:
{
  "veracityScore": <number 0-100>,
  "manipulationRisk": <number 0-100>,
  "emotionalTriggers": { "outrage": <0-100>, "fear": <0-100>, "urgency": <0-100>, "tribalism": <0-100>, "conspiracy": <0-100>, "fatalism": <0-100> },
  "detectedFallacies": [ { "name": "<fallacy name>", "confidence": <0-1> } ],
  "biasIndicators": [ "<indicator 1>", "<indicator 2>" ],
  "confidence": <number 0-100>,
  "sources": [ "<source reference 1>", "<source reference 2>" ],
  "reasoning": "<structured paragraph explaining the epistemic verdict and empirical consensus>",
  "prebunkSummary": "<one sentence refutation ready for community dissemination>"
}`;

    const doFetch = VerdadEngine.fetchImpl || fetch;
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) throw new Error(`Gemini API failed with status ${res.status}`);
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    const parsed = sanitizeDeep(JSON.parse(content)) || {};
    const heuristicBackbone = this.runOfflineHeuristics(text);

    const veracityScore = typeof parsed.veracityScore === 'number' ? parsed.veracityScore : heuristicBackbone.veracityScore;
    const manipulationRisk = typeof parsed.manipulationRisk === 'number' ? parsed.manipulationRisk : heuristicBackbone.manipulationRisk;
    const recommendation = manipulationRisk >= 70 ? 'block' : manipulationRisk >= 40 ? 'caution' : 'share';
    const verdictClass = recommendation === 'block' ? 'unreliable' : recommendation === 'caution' ? 'unverified' : 'plausible';

    const step5_synthesis = {
      manipulationRisk,
      veracityScore,
      recommendation,
      verdictClass,
      rationale: parsed.reasoning || heuristicBackbone.step5_synthesis.rationale,
      prebunkBrief: parsed.prebunkSummary || heuristicBackbone.step5_synthesis.prebunkBrief,
      keyFlags: parsed.biasIndicators || heuristicBackbone.step5_synthesis.keyFlags
    };

    return {
      claimText: text,
      veracityScore,
      manipulationRisk,
      credibilityTier: manipulationRisk >= 75 ? 'Critical Epistemic Threat' : manipulationRisk >= 50 ? 'High Manipulation Risk' : manipulationRisk >= 25 ? 'Moderate Caution' : 'High Credibility / Low Manipulation',
      isLiveApi: true,
      step1_affect: {
        ...heuristicBackbone.step1_affect,
        ...(parsed.emotionalTriggers || {})
      },
      step2_fallacies: (parsed.detectedFallacies && parsed.detectedFallacies.length > 0) ? parsed.detectedFallacies : heuristicBackbone.step2_fallacies,
      step3_epistemics: heuristicBackbone.step3_epistemics,
      step4_sources: heuristicBackbone.step4_sources,
      step5_synthesis,
      emotionalTriggers: parsed.emotionalTriggers || heuristicBackbone.emotionalTriggers,
      detectedFallacies: (parsed.detectedFallacies && parsed.detectedFallacies.length > 0) ? parsed.detectedFallacies : heuristicBackbone.detectedFallacies,
      biasIndicators: parsed.biasIndicators || ['Live Gemini Evaluation'],
      confidence: parsed.confidence ?? 85,
      sources: parsed.sources || ['Gemini Neural Knowledge Model'],
      reasoning: parsed.reasoning || 'Live LLM analysis completed.',
      prebunkSummary: parsed.prebunkSummary || 'Verified by independent cross-source evaluation.',
      epistemicMetrics: heuristicBackbone.epistemicMetrics
    };
  }
}

export const VerdadModule = {
  _app: null,
  _sources: null,
  _fallacies: null,
  _rules: null,
  _lastResult: null,
  _lastClaimText: '',
  _adversarialReframings: null,
  _activeSandboxVector: 'outrageMaximizer',
  _selectedVulnerabilityIndex: null,
  _selectedBriefIndex: null,
  _sandboxEvaluated: false,
  _sandboxTimer: null,
  _presets: {
    'bank-run': 'URGENT BREAKING: Regional commercial bank is experiencing a massive liquidity collapse right now! Central regulators are secretly freezing customer deposits! Withdraw all your cash immediately before it is too late!',
    'election-hack': 'Shocking leaked audio confirms the election board software was hacked by foreign operatives! Do not listen to the corrupt mayor and lunatic officials who are covering it up!',
    'miracle-cure': 'Mainstream pharma companies are hiding this 100% proven miraculous herbal extract that completely cures all stage-4 cancers with absolute certainty beyond all doubt!',
    'wildfire-arson': 'Top secret satellite imagery indisputably proves that the recent wildfires were coordinated by international energy cartels as part of a hidden globalist agenda!'
  },

  async init(app) {
    this._app = app;
    await this._loadDatasets();
    this._bindEvents();
    console.log('[VerdadModule] Initialized.');
  },

  async _loadDatasets() {
    try {
      const srcRes = await fetch('./data/sources.json').catch(() => fetch('data/sources.json'));
      if (srcRes.ok) {
        this._sources = await srcRes.json();
        VerdadEngine.sourcesDatabase = this._sources;
      }
    } catch (e) {
      console.warn('[VerdadModule] Could not load data/sources.json', e);
    }

    try {
      const falRes = await fetch('./data/fallacies.json').catch(() => fetch('data/fallacies.json'));
      if (falRes.ok) {
        this._fallacies = await falRes.json();
        VerdadEngine.fallaciesDatabase = this._fallacies;
      }
    } catch (e) {
      console.warn('[VerdadModule] Could not load data/fallacies.json', e);
    }

    try {
      const ruleRes = await fetch('./data/verdad_rules.json').catch(() => fetch('data/verdad_rules.json'));
      if (ruleRes.ok) {
        this._rules = await ruleRes.json();
      }
    } catch (e) {
      console.warn('[VerdadModule] Could not load data/verdad_rules.json', e);
    }
  },

  onMount() {
    const textarea = document.getElementById('textarea-verdad-claim');
    if (textarea && !textarea.value.trim()) {
      textarea.value = this._presets['bank-run'];
    }

    // Auto-render default preset on initial mount if container is empty
    const cotContainer = document.getElementById('verdad-dialectic-cot-container');
    if (cotContainer && !this._lastResult) {
      const defaultText = textarea ? textarea.value.trim() : this._presets['bank-run'];
      this._lastClaimText = defaultText;
      const initResult = VerdadEngine.runOfflineHeuristics(defaultText, this._rules || VerdadEngine.defaultRules, this._sources, this._fallacies);
      this._lastResult = initResult;
      this._renderResults(initResult);
    }
  },

  _bindEvents() {
    const selectPreset = document.getElementById('select-verdad-preset');
    const textarea = document.getElementById('textarea-verdad-claim');
    const btnAudit = document.getElementById('btn-run-verdad-audit');
    const btnCopyCard = document.getElementById('btn-copy-counter-card');

    if (selectPreset && textarea) {
      selectPreset.addEventListener('change', () => {
        const val = selectPreset.value;
        if (this._presets[val]) {
          textarea.value = this._presets[val];
          this._app?.showToast({ type: 'info', title: 'PRESET LOADED', message: `Loaded ${val} scenario.` });
        }
      });
    }

    if (btnAudit) {
      btnAudit.addEventListener('click', () => this.executeAudit());
    }

    if (btnCopyCard) {
      btnCopyCard.addEventListener('click', () => {
        const cardText = document.getElementById('verdad-counter-card')?.innerText || '';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(cardText).then(() => {
            this._app?.showToast({ type: 'success', title: 'COPIED TO CLIPBOARD', message: 'Counter-narrative prebunk card copied.' });
          });
        }
      });
    }

    document.getElementById('btn-read-clipboard')?.addEventListener('click', () => this.readClipboard());
    document.getElementById('btn-copy-bookmarklet')?.addEventListener('click', () => this.copyBookmarklet());
  },

  readClipboard() {
    this._app?._readClipboard?.();
  },

  copyBookmarklet() {
    const base = window.location.origin + window.location.pathname;
    const snippet = buildBookmarklet(base);

    const showSnippet = () => {
      const input = document.getElementById('bookmarklet-snippet');
      if (input) input.value = snippet;
      this._app?.showToast({
        type: 'info',
        title: 'INSTALL BOOKMARKLET',
        message: 'Create a new bookmark and paste the copied snippet as its URL. Select text on any page, then run it.',
        duration: 8000
      });
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(snippet)
        .then(() => {
          const input = document.getElementById('bookmarklet-snippet');
          if (input) input.value = snippet;
          this._app?.showToast({ type: 'success', title: 'BOOKMARKLET COPIED', message: 'Paste it as the URL of a new bookmark. Select text anywhere, then run it.' });
        })
        .catch(showSnippet);
    } else {
      showSnippet();
    }
  },

  async executeAudit() {
    const textarea = document.getElementById('textarea-verdad-claim');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
      this._app?.showToast({ type: 'warning', title: 'EMPTY INPUT', message: 'Please enter or paste a claim statement to analyze.' });
      return;
    }

    const btnAudit = document.getElementById('btn-run-verdad-audit');
    if (btnAudit) {
      btnAudit.disabled = true;
      btnAudit.innerHTML = '<span>⏳ Executing Neural & Heuristic Audit...</span>';
    }

    const apiKey = this._app?.store?.get('verdad.byokApiKey', null);
    const forceOffline = this._app?.store?.get('verdad.offlineOnly', false);
    const mode = forceOffline ? 'offline' : 'auto';

    try {
      this._lastClaimText = text;
      const result = await VerdadEngine.analyzeClaim(text, {
        apiKey,
        mode,
        model: this._app?.store?.get('verdad.preferredModel', 'gemini-2.0-flash')
      });
      this._lastResult = result;
      this._renderResults(result);

      const factKey = this._app?.store?.get('verdad.factCheckApiKey', null);
      this._renderFactChecks({ status: 'pending', reviews: [], message: 'Searching published fact-checks…' });
      const fc = await searchFactChecks(text, factKey);
      this._renderFactChecks(fc);
      this._app?.showToast({
        type: result.manipulationRisk > 60 ? 'danger' : result.manipulationRisk > 30 ? 'warning' : 'success',
        title: result.isLiveApi ? 'GEMINI AUDIT COMPLETE' : 'HEURISTIC AUDIT COMPLETE',
        message: `Veracity: ${result.veracityScore}% • Risk: ${result.manipulationRisk}% (${result.credibilityTier || 'Analyzed'})`
      });
    } catch (err) {
      console.error('[VerdadModule] Audit error:', err);
      this._app?.showToast({ type: 'danger', title: 'AUDIT FAILED', message: err.message });
    } finally {
      if (btnAudit) {
        btnAudit.disabled = false;
        btnAudit.innerHTML = '<span>🛡️ Execute Epistemic Audit</span>';
      }
    }
  },

  _renderFactChecks(fc) {
    const host = document.getElementById('verdad-factcheck-panel');
    if (!host) return;

    if (fc.status === 'pending') {
      host.innerHTML = `
        <div class="status-label text-stone" style="font-size:0.72rem;">PUBLISHED FACT-CHECKS</div>
        <p class="body-text" style="font-size:0.82rem;margin:6px 0 0 0;color:var(--stone-warm);">${esc(fc.message)}</p>`;
      return;
    }

    if (fc.status === 'no-key') {
      host.innerHTML = `
        <div class="status-label text-stone" style="font-size:0.72rem;">PUBLISHED FACT-CHECKS</div>
        <p class="body-text" style="font-size:0.8rem;margin:6px 0 8px 0;color:var(--stone-light);">
          Not configured. Add a free Google Fact Check Tools API key in Settings to search
          ClaimReview records published by IFCN-signatory fact-checkers.
        </p>
        <button class="btn btn-outline btn-sm" data-aegis-action="open-modal" data-aegis-modal="modal-byok-settings">Configure key</button>`;
      return;
    }

    if (fc.status === 'error') {
      host.innerHTML = `
        <div class="status-label" style="font-size:0.72rem;color:var(--suspicion-amber, #f59e0b);">PUBLISHED FACT-CHECKS — LOOKUP FAILED</div>
        <p class="body-text" style="font-size:0.8rem;margin:6px 0 0 0;">${esc(fc.message)}</p>
        <p class="body-text" style="font-size:0.76rem;margin:6px 0 0 0;color:var(--stone-warm);">
          Heuristic analysis above is unaffected. A failed lookup tells you nothing about the claim.
        </p>`;
      return;
    }

    if (fc.status === 'no-results') {
      host.innerHTML = `
        <div class="status-label text-stone" style="font-size:0.72rem;">PUBLISHED FACT-CHECKS — NONE FOUND</div>
        <p class="body-text" style="font-size:0.8rem;margin:6px 0 0 0;">${esc(fc.message)}</p>
        <p class="body-text" style="font-size:0.74rem;margin:6px 0 0 0;color:var(--stone-warm);font-family:var(--font-mono);">
          query: ${esc(fc.query)}
        </p>`;
      return;
    }

    const rows = fc.reviews.slice(0, 8).map(r => `
      <div class="card-granite-inset" style="padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div style="font-weight:600;font-size:0.82rem;color:var(--parchment-bright);">${esc(r.publisher)}</div>
          <span class="badge badge-bronze" style="font-size:0.68rem;white-space:nowrap;">${esc(r.rating)}</span>
        </div>
        ${r.reviewedClaim ? `<div style="font-size:0.78rem;color:var(--stone-light);margin-top:4px;">Reviewed claim: “${esc(r.reviewedClaim)}”</div>` : ''}
        ${r.claimant ? `<div style="font-size:0.74rem;color:var(--stone-warm);margin-top:2px;">Attributed to: ${esc(r.claimant)}</div>` : ''}
        <div style="margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          ${r.url ? `<a href="${escUrl(r.url)}" target="_blank" rel="noopener noreferrer nofollow" style="font-size:0.76rem;color:var(--intel-cyan, #38bdf8);">Read the fact-check →</a>` : ''}
          ${r.reviewDate ? `<span style="font-size:0.72rem;color:var(--stone-warm);font-family:var(--font-mono);">${esc(r.reviewDate)}</span>` : ''}
        </div>
      </div>`).join('');

    host.innerHTML = `
      <div class="status-label text-emerald" style="font-size:0.72rem;">PUBLISHED FACT-CHECKS — ${esc(fc.reviews.length)} MATCHED</div>
      <p class="body-text" style="font-size:0.78rem;margin:6px 0 10px 0;color:var(--stone-light);">${esc(fc.message)}</p>
      ${rows}
      <p class="body-text" style="font-size:0.74rem;margin:4px 0 0 0;color:var(--stone-warm);">
        Matching is keyword-based — confirm each review actually addresses your claim before relying on it.
      </p>`;
  },

  _renderResults(res) {
    const veracityEl = document.getElementById('verdad-veracity-score');
    const emotionEl = document.getElementById('verdad-emotional-score');
    const fallaciesEl = document.getElementById('verdad-fallacies-count');
    const sourceEl = document.getElementById('verdad-source-score');
    const flagsList = document.getElementById('verdad-flags-list');
    const counterCard = document.getElementById('verdad-counter-card');

    if (veracityEl) {
      veracityEl.textContent = `${res.veracityScore}%`;
      veracityEl.className = `metric-value ${res.veracityScore >= 70 ? 'text-emerald' : res.veracityScore >= 40 ? 'text-amber' : 'text-crimson'}`;
    }

    if (emotionEl) {
      const maxEmo = Math.max(...Object.values(res.emotionalTriggers || {}), 0);
      emotionEl.textContent = `${(maxEmo / 10).toFixed(1)} / 10`;
      emotionEl.className = `metric-value ${maxEmo >= 70 ? 'text-crimson' : maxEmo >= 40 ? 'text-amber' : 'text-emerald'}`;
    }

    if (fallaciesEl) {
      const count = res.detectedFallacies?.length || 0;
      fallaciesEl.textContent = `${count} MATCH${count === 1 ? '' : 'ES'}`;
      fallaciesEl.className = `metric-value ${count > 0 ? 'text-bronze' : 'text-emerald'}`;
    }

    if (sourceEl) {
      const primarySource = res.step4_sources?.[0];
      if (primarySource && primarySource.matched) {
        sourceEl.textContent = `${primarySource.admiraltyRating} • ${primarySource.name}`;
        sourceEl.className = `metric-value ${primarySource.admiraltyRating.startsWith('A') || primarySource.admiraltyRating.startsWith('B') ? 'text-emerald' : 'text-amber'}`;
      } else if (primarySource && primarySource.domain) {
        sourceEl.textContent = `F6 • ${primarySource.domain}`;
        sourceEl.className = 'metric-value text-amber';
      } else {
        sourceEl.textContent = res.isLiveApi ? 'GEMINI 1.5 FLASH' : 'F6 • ANONYMOUS';
        sourceEl.className = 'metric-value text-muted';
      }
    }

    // Render 5-Step Epistemic Chain-of-Thought Dialectic
    this._renderChainOfThought(res);

    // Render Adversarial Sandbox Challenge Mode
    this._renderAdversarialSandbox(res);

    // Render Backwards-compatible flags list if present
    if (flagsList) {
      let html = '';
      if (res.detectedFallacies && res.detectedFallacies.length > 0) {
        for (const f of res.detectedFallacies) {
          html += `
            <div class="card-granite-inset" style="border-left: 3px solid var(--disinfo-crimson);">
              <div class="flex-row-gap" style="justify-content: space-between;">
                <span class="status-label text-crimson">FALLACY: ${esc(f.name.toUpperCase())}</span>
                <span class="badge badge-disinfo">CONFIDENCE ${Math.round((f.confidence || 0.85) * 100)}%</span>
              </div>
              <p class="body-text" style="margin-top: 4px;">Detected structural flaw: <em>${esc(f.quote || f.name)}</em></p>
            </div>
          `;
        }
      }

      for (const [vec, score] of Object.entries(res.emotionalTriggers || {})) {
        if (score >= 40) {
          const isUrgency = vec.toLowerCase() === 'urgency';
          html += `
            <div class="card-granite-inset" style="border-left: 3px solid var(--suspicion-amber);">
              <div class="flex-row-gap" style="justify-content: space-between;">
                <span class="status-label text-amber">${isUrgency ? 'URGENCY TRIGGER & VECTOR' : `${vec.toUpperCase()} VECTOR`}</span>
                <span class="badge badge-suspicion">INTENSITY ${esc(score)}%</span>
              </div>
              <p class="body-text" style="margin-top: 4px;">High emotional manipulation pressure detected targeting ${esc(vec)}.</p>
            </div>
          `;
        }
      }

      if (!html) {
        html = `
          <div class="card-granite-inset" style="border-left: 3px solid var(--veracity-green);">
            <span class="status-label text-emerald">NO HIGH-RISK MANIPULATION FLAGS</span>
            <p class="body-text" style="margin-top: 4px;">Statement language matches objective, verifiable reporting patterns.</p>
          </div>
        `;
      }

      flagsList.innerHTML = html;
    }

    if (counterCard) {
      const summaryText = res.prebunkSummary || res.reasoning || 'Analysis completed using multi-vector NLP heuristics.';
      counterCard.innerHTML = `
        <div class="heading-4 text-bronze">Fact Check Summary — Verified Counter-Narrative</div>
        <p class="body-text" style="font-size: 0.9rem; margin-top: var(--space-2); line-height: 1.5;">
          ${esc(summaryText)}
        </p>
        <div style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 12px; text-align: right;">
          <button class="btn btn-secondary" id="btn-verdad-pin" style="font-size: 0.8rem;">📌 Pin to Dossier</button>
        </div>
      `;

      const pinBtn = document.getElementById('btn-verdad-pin');
      if (pinBtn) {
        pinBtn.addEventListener('click', () => {
          const contentStr = `Veracity Score: ${res.veracityScore}%\n` +
                             `Fallacies Detected: ${res.detectedFallacies?.map(f => f.name).join(', ') || 'None'}\n\n` +
                             `Summary: ${summaryText}`;
          window.dispatchEvent(new CustomEvent('aegis:pin', {
            detail: {
              source: 'VERDAD Engine',
              title: 'Truth Pipeline Analysis',
              content: contentStr
            }
          }));
          this._app?.showToast({ type: 'success', title: 'PINNED TO DOSSIER', message: 'Analysis added to Epistemic Dossier.' });
        });
      }
    }
  },

  /**
   * Render the 5-Step Epistemic Chain-of-Thought Dialectic Panel.
   */
  _renderChainOfThought(res) {
    const container = document.getElementById('verdad-dialectic-cot-container');
    if (!container) return;

    const affect = res.step1_affect || {};
    const fallacies = res.step2_fallacies || [];
    const epistemics = res.step3_epistemics || {};
    const sources = res.step4_sources || [];
    const synthesis = res.step5_synthesis || {};

    const vectorList = [
      { key: 'outrage', name: 'Outrage', color: 'var(--disinfo-crimson)' },
      { key: 'fear', name: 'Fear / Dread', color: 'var(--disinfo-crimson)' },
      { key: 'urgency', name: 'Urgency Pressure', color: 'var(--suspicion-amber)' },
      { key: 'tribalism', name: 'Tribal Hostility', color: 'var(--suspicion-amber)' },
      { key: 'conspiracy', name: 'Conspiratorial Agency', color: 'var(--bronze-primary)' },
      { key: 'fatalism', name: 'Fatalism / Despair', color: 'var(--stone-warm)' }
    ];

    const affectBarsHtml = vectorList.map(v => {
      const score = affect[v.key] ?? 0;
      const kws = affect.triggeredKeywords?.[v.key] || [];
      return `
        <div style="background:var(--bg-surface-inset);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;font-weight:600;margin-bottom:4px;">
            <span style="color:var(--parchment-bright);">${esc(v.name)}</span>
            <span style="color:${score >= 70 ? 'var(--disinfo-crimson)' : score >= 40 ? 'var(--suspicion-amber)' : 'var(--veracity-green)'};">${score}%</span>
          </div>
          <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:6px;">
            <div style="width:${score}%;height:100%;background:${score >= 70 ? 'var(--disinfo-crimson)' : score >= 40 ? 'var(--suspicion-amber)' : 'var(--bronze-primary)'};transition:width 0.3s ease;"></div>
          </div>
          <div style="font-size:0.72rem;color:var(--stone-light);min-height:16px;">
            ${kws.length > 0 ? kws.slice(0, 3).map(k => `<span class="badge badge-bronze" style="font-size:0.65rem;padding:1px 4px;margin-right:4px;">${esc(k)}</span>`).join('') : '<span style="color:var(--stone-warm);font-style:italic;">No trigger tokens</span>'}
          </div>
        </div>
      `;
    }).join('');

    const fallaciesHtml = fallacies.length > 0
      ? fallacies.map(f => `
          <div class="card-granite-inset" style="border-left:3px solid var(--disinfo-crimson);margin-bottom:8px;padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <div>
                <span style="font-weight:700;font-size:0.85rem;color:var(--disinfo-crimson);">${esc(f.name)}</span>
                <span style="font-style:italic;font-size:0.78rem;color:var(--bronze-light);margin-left:6px;">(${esc(f.latin || 'Non Sequitur')})</span>
              </div>
              <span class="badge badge-disinfo" style="font-size:0.68rem;">CONFIDENCE ${Math.round((f.confidence || 0.85) * 100)}%</span>
            </div>
            ${f.quote ? `<div style="font-size:0.8rem;color:var(--parchment-bright);margin:6px 0;padding:4px 8px;background:rgba(239,68,68,0.08);border-radius:var(--radius-sm);font-family:var(--font-mono);">“${esc(f.quote)}”</div>` : ''}
            <p class="body-text" style="font-size:0.78rem;color:var(--stone-light);margin:0;">${esc(f.explanation || 'Detected structural defect in argument logic.')}</p>
          </div>
        `).join('')
      : `
        <div class="card-granite-inset" style="border-left:3px solid var(--veracity-green);padding:10px 12px;">
          <span class="status-label text-emerald">NO STRUCTURAL FALLACIES DETECTED</span>
          <p class="body-text" style="font-size:0.8rem;color:var(--stone-light);margin-top:4px;">
            Syntactic structure exhibits coherent premise-conclusion flow without formal logical fallacies.
          </p>
        </div>
      `;

    const sourcesHtml = sources.map(s => {
      const admiraltyColor = s.admiraltyRating?.startsWith('A') ? 'var(--veracity-green)' :
                             s.admiraltyRating?.startsWith('B') ? 'var(--intel-cyan)' :
                             s.admiraltyRating?.startsWith('C') ? 'var(--bronze-primary)' :
                             s.admiraltyRating?.startsWith('D') ? 'var(--suspicion-amber)' : 'var(--disinfo-crimson)';
      return `
        <div class="card-granite-inset" style="border-left:3px solid ${admiraltyColor};margin-bottom:8px;padding:12px 14px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-weight:700;font-size:0.9rem;color:var(--parchment-bright);">${esc(s.name)}</div>
              ${s.domain ? `<div style="font-size:0.75rem;color:var(--intel-cyan);font-family:var(--font-mono);">${esc(s.domain)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <span class="badge" style="background:rgba(255,255,255,0.06);border:1px solid ${admiraltyColor};color:${admiraltyColor};font-weight:700;">
                ADMIRALTY: ${esc(s.admiraltyRating)}
              </span>
              <span class="badge badge-bronze">${esc(s.factuality)}</span>
            </div>
          </div>
          <div style="font-size:0.78rem;color:var(--stone-light);margin:6px 0;">
            ${esc(s.admiraltyDescription)}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:8px;margin-top:8px;font-size:0.74rem;color:var(--stone-warm);background:rgba(0,0,0,0.2);padding:8px 10px;border-radius:var(--radius-sm);">
            <div><strong>Bias Rating:</strong> ${esc(s.bias)}</div>
            <div><strong>Credibility Index:</strong> ${s.credibilityScore}%</div>
            <div><strong>Ownership:</strong> ${esc(s.ownership || 'Unknown')}</div>
            <div><strong>Funding Transparency:</strong> ${esc(s.fundingTransparency || 'Unknown')}</div>
          </div>
          ${s.retractionHistory ? `
            <div style="font-size:0.72rem;color:var(--stone-warm);margin-top:6px;">
              <strong>Correction Protocol:</strong> ${esc(s.retractionHistory.protocolAdherence || 'Standard')} — ${esc(s.retractionHistory.notes || 'Documented corrections.')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const recBadge = synthesis.recommendation === 'block'
      ? `<span class="badge badge-disinfo" style="font-size:0.78rem;padding:4px 8px;">⚠️ BLOCK RECOMMENDATION — HIGH DECEPTION RISK</span>`
      : synthesis.recommendation === 'caution'
      ? `<span class="badge badge-suspicion" style="font-size:0.78rem;padding:4px 8px;">⚡ CAUTION RECOMMENDATION — UNVERIFIED CLAIM</span>`
      : `<span class="badge badge-veracity" style="font-size:0.78rem;padding:4px 8px;">🛡️ SHARE PERMISSIBLE — PLAUSIBLE CLAIM</span>`;

    container.innerHTML = `
      <div class="card-header">
        <div>
          <h3 class="card-title">EPISTEMIC CHAIN-OF-THOUGHT DIALECTIC</h3>
          <div style="font-size:0.75rem;color:var(--stone-light);margin-top:2px;">5-Stage Transparent Multi-Vector Reasoning Matrix</div>
        </div>
        <span class="badge badge-intel">TRANSPARENT FORENSICS</span>
      </div>

      <!-- STEP 1: LEXICAL AFFECT RADAR -->
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);border-left:3px solid var(--bronze-primary);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="status-label text-bronze" style="font-weight:700;">STAGE 01 // LEXICAL AFFECT RADAR & INTENSITY VECTORS</span>
          <span class="badge ${affect.dominantVector ? 'badge-suspicion' : 'badge-veracity'}">
            ${affect.dominantVector ? 'DOMINANT VECTOR: ' + affect.dominantVector.toUpperCase() : 'AFFECT: NEUTRAL'}
          </span>
        </div>
        <p class="body-text" style="font-size:0.8rem;color:var(--stone-light);margin-bottom:10px;">
          Scans emotional arousal vectors to identify System 1 cognitive manipulation hooks.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:8px;">
          ${affectBarsHtml}
        </div>
      </div>

      <!-- STEP 2: LOGICAL FALLACIES -->
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);border-left:3px solid ${fallacies.length > 0 ? 'var(--disinfo-crimson)' : 'var(--veracity-green)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="status-label ${fallacies.length > 0 ? 'text-crimson' : 'text-emerald'}" style="font-weight:700;">STAGE 02 // LOGICAL FALLACY & RHETORICAL PATTERNS</span>
          <span class="badge ${fallacies.length > 0 ? 'badge-disinfo' : 'badge-veracity'}">
            ${fallacies.length} FALLAC${fallacies.length === 1 ? 'Y' : 'IES'} MATCHED
          </span>
        </div>
        <p class="body-text" style="font-size:0.8rem;color:var(--stone-light);margin-bottom:10px;">
          Evaluates formal and informal syllogistic flaws with exact textual quotes and Latin designations.
        </p>
        ${fallaciesHtml}
      </div>

      <!-- STEP 3: EPISTEMIC PRECISION & CALIBRATION -->
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);border-left:3px solid var(--intel-cyan);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="status-label text-cyan" style="font-weight:700;">STAGE 03 // EPISTEMIC PRECISION & CERTAINTY CALIBRATION</span>
          <span class="badge badge-intel">${esc(epistemics.readingLevel || 'Standard Calibration')}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:8px;margin-bottom:10px;">
          <div style="background:var(--bg-surface-inset);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 10px;">
            <div style="font-size:0.72rem;color:var(--stone-warm);">Hedging Ratio</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--parchment-bright);">${(epistemics.hedgingRatio * 100).toFixed(0)}%</div>
            <div style="font-size:0.68rem;color:var(--stone-light);">${epistemics.hedgingMatches?.length || 0} qualifiers</div>
          </div>
          <div style="background:var(--bg-surface-inset);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 10px;">
            <div style="font-size:0.72rem;color:var(--stone-warm);">Certainty Inflation</div>
            <div style="font-size:1.1rem;font-weight:700;color:${epistemics.certaintyInflation > 40 ? 'var(--disinfo-crimson)' : 'var(--emerald-light)'};">${epistemics.certaintyInflation}%</div>
            <div style="font-size:0.68rem;color:var(--stone-light);">${epistemics.certaintyMatches?.length || 0} dogmatic markers</div>
          </div>
          <div style="background:var(--bg-surface-inset);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:8px 10px;">
            <div style="font-size:0.72rem;color:var(--stone-warm);">Token Volume</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--parchment-bright);">${epistemics.wordCount}</div>
            <div style="font-size:0.68rem;color:var(--stone-light);">lexical words</div>
          </div>
        </div>
        ${epistemics.certaintyMatches?.length > 0 ? `
          <div style="font-size:0.74rem;color:var(--stone-light);margin-top:6px;">
            <strong>Certainty Markers:</strong> ${epistemics.certaintyMatches.map(m => `<span class="badge badge-disinfo" style="font-size:0.68rem;padding:1px 5px;margin-left:4px;">${esc(m)}</span>`).join('')}
          </div>
        ` : ''}
        ${epistemics.hedgingMatches?.length > 0 ? `
          <div style="font-size:0.74rem;color:var(--stone-light);margin-top:4px;">
            <strong>Hedging Qualifiers:</strong> ${epistemics.hedgingMatches.map(m => `<span class="badge badge-bronze" style="font-size:0.68rem;padding:1px 5px;margin-left:4px;">${esc(m)}</span>`).join('')}
          </div>
        ` : ''}
      </div>

      <!-- STEP 4: SOURCE CREDIBILITY DOSSIER -->
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);border-left:3px solid var(--bronze-primary);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="status-label text-bronze" style="font-weight:700;">STAGE 04 // SOURCE DIRECTORY & ADMIRALTY CREDIBILITY DOSSIER</span>
          <span class="badge badge-intel">${sources.length} SOURCE RECORD${sources.length === 1 ? '' : 'S'}</span>
        </div>
        <p class="body-text" style="font-size:0.8rem;color:var(--stone-light);margin-bottom:10px;">
          Cross-referenced against verified media provenance directory and defense intelligence Admiralty scale ($A1 \\dots F6$).
        </p>
        ${sourcesHtml}
      </div>

      <!-- STEP 5: SYNTHESIS & RECOMMENDATION -->
      <div class="card-granite-inset" style="border-left:3px solid ${synthesis.recommendation === 'block' ? 'var(--disinfo-crimson)' : synthesis.recommendation === 'caution' ? 'var(--suspicion-amber)' : 'var(--veracity-green)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <span class="status-label ${synthesis.recommendation === 'block' ? 'text-crimson' : synthesis.recommendation === 'caution' ? 'text-amber' : 'text-emerald'}" style="font-weight:700;">
            STAGE 05 // DIALECTIC SYNTHESIS & PREBUNK RECOMMENDATION
          </span>
          ${recBadge}
        </div>
        <p class="body-text" style="font-size:0.85rem;color:var(--stone-light);line-height:1.55;margin:8px 0 12px 0;">
          ${esc(synthesis.rationale || 'Analysis complete.')}
        </p>
        <div class="card-granite-inset" style="background:var(--bg-surface-elevated);border:1px solid var(--border-interactive);padding:12px;margin-bottom:10px;">
          <div style="font-weight:700;font-size:0.8rem;color:var(--bronze-light);margin-bottom:4px;">SOVEREIGN INOCULATION PREBUNK BRIEF</div>
          <div style="font-size:0.88rem;color:var(--parchment-bright);font-style:italic;">“${esc(synthesis.prebunkBrief || 'No prebunk summary available.')}”</div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" id="btn-copy-prebunk-cot">📋 Copy Prebunk Brief</button>
          <button class="btn btn-secondary btn-sm" id="btn-pin-prebunk-cot">📌 Pin to Epistemic Dossier</button>
        </div>
      </div>
    `;

    document.getElementById('btn-copy-prebunk-cot')?.addEventListener('click', () => {
      if (navigator.clipboard && synthesis.prebunkBrief) {
        navigator.clipboard.writeText(synthesis.prebunkBrief).then(() => {
          this._app?.showToast({ type: 'success', title: 'COPIED TO CLIPBOARD', message: 'Prebunk brief copied for community dissemination.' });
        });
      }
    });

    document.getElementById('btn-pin-prebunk-cot')?.addEventListener('click', () => {
      const contentStr = `Veracity Score: ${res.veracityScore}%\n` +
                         `Manipulation Risk: ${res.manipulationRisk}%\n` +
                         `Recommendation: ${synthesis.recommendation?.toUpperCase()}\n\n` +
                         `Dialectic Rationale:\n${synthesis.rationale}\n\n` +
                         `Prebunk Brief:\n${synthesis.prebunkBrief}`;
      window.dispatchEvent(new CustomEvent('aegis:pin', {
        detail: {
          source: 'VERDAD CoT Dialectic',
          title: 'Epistemic Audit & Inoculation Brief',
          content: contentStr
        }
      }));
      this._app?.showToast({ type: 'success', title: 'PINNED TO DOSSIER', message: 'Dialectic analysis pinned to Epistemic Dossier.' });
    });
  },

  /**
   * Render the Adversarial Sandbox Challenge Mode.
   */
  _renderAdversarialSandbox(res) {
    const host = document.getElementById('verdad-adversarial-sandbox');
    if (!host) return;

    this._adversarialReframings = VerdadEngine.generateAdversarialReframings(this._lastClaimText, res);
    this._selectedVulnerabilityIndex = null;
    this._selectedBriefIndex = null;
    this._sandboxEvaluated = false;
    this._sandboxTimer = startTimer();

    this._renderSandboxContent();
  },

  _renderSandboxContent() {
    const host = document.getElementById('verdad-adversarial-sandbox');
    if (!host || !this._adversarialReframings) return;

    const reframing = this._adversarialReframings[this._activeSandboxVector];
    if (!reframing) return;

    const vulnOptionsHtml = reframing.vulnerabilityOptions.map((opt, idx) => {
      const isChecked = this._selectedVulnerabilityIndex === idx;
      let stateStyle = 'border:1px solid var(--border-subtle);';
      if (this._sandboxEvaluated) {
        if (idx === reframing.correctVulnerabilityIndex) {
          stateStyle = 'border:1px solid var(--veracity-green);background:rgba(16,185,129,0.1);';
        } else if (isChecked && idx !== reframing.correctVulnerabilityIndex) {
          stateStyle = 'border:1px solid var(--disinfo-crimson);background:rgba(239,68,68,0.1);';
        }
      } else if (isChecked) {
        stateStyle = 'border:1px solid var(--bronze-primary);background:rgba(212,163,89,0.08);';
      }

      return `
        <label class="card-granite-inset" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;${stateStyle}">
          <input type="radio" name="sandbox-vuln-option" value="${idx}" ${isChecked ? 'checked' : ''} ${this._sandboxEvaluated ? 'disabled' : ''} style="cursor:pointer;" />
          <span style="font-size:0.84rem;color:var(--parchment-bright);">${esc(opt)}</span>
          ${this._sandboxEvaluated && idx === reframing.correctVulnerabilityIndex ? '<span class="badge badge-veracity" style="margin-left:auto;font-size:0.68rem;">OPTIMAL TARGET</span>' : ''}
          ${this._sandboxEvaluated && isChecked && idx !== reframing.correctVulnerabilityIndex ? '<span class="badge badge-disinfo" style="margin-left:auto;font-size:0.68rem;">MISIDENTIFIED</span>' : ''}
        </label>
      `;
    }).join('');

    const briefOptionsHtml = reframing.counterBriefOptions.map((opt, idx) => {
      const isChecked = this._selectedBriefIndex === idx;
      let stateStyle = 'border:1px solid var(--border-subtle);';
      if (this._sandboxEvaluated) {
        if (idx === reframing.correctBriefIndex) {
          stateStyle = 'border:1px solid var(--veracity-green);background:rgba(16,185,129,0.1);';
        } else if (isChecked && idx !== reframing.correctBriefIndex) {
          stateStyle = 'border:1px solid var(--disinfo-crimson);background:rgba(239,68,68,0.1);';
        }
      } else if (isChecked) {
        stateStyle = 'border:1px solid var(--bronze-primary);background:rgba(212,163,89,0.08);';
      }

      return `
        <label class="card-granite-inset" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;${stateStyle}">
          <input type="radio" name="sandbox-brief-option" value="${idx}" ${isChecked ? 'checked' : ''} ${this._sandboxEvaluated ? 'disabled' : ''} style="cursor:pointer;margin-top:3px;" />
          <span style="font-size:0.84rem;color:var(--parchment-bright);line-height:1.45;">${esc(opt)}</span>
          ${this._sandboxEvaluated && idx === reframing.correctBriefIndex ? '<span class="badge badge-veracity" style="margin-left:auto;white-space:nowrap;font-size:0.68rem;">OPTIMAL PREBUNK</span>' : ''}
          ${this._sandboxEvaluated && isChecked && idx !== reframing.correctBriefIndex ? '<span class="badge badge-disinfo" style="margin-left:auto;white-space:nowrap;font-size:0.68rem;">SUB-OPTIMAL</span>' : ''}
        </label>
      `;
    }).join('');

    let feedbackCardHtml = '';
    if (this._sandboxEvaluated) {
      const isVulnCorrect = this._selectedVulnerabilityIndex === reframing.correctVulnerabilityIndex;
      const isBriefCorrect = this._selectedBriefIndex === reframing.correctBriefIndex;
      const isFullyCorrect = isVulnCorrect && isBriefCorrect;

      feedbackCardHtml = `
        <div class="card-granite-inset" style="margin-top:var(--space-4);border-left:3px solid ${isFullyCorrect ? 'var(--veracity-green)' : 'var(--suspicion-amber)'};padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="status-label ${isFullyCorrect ? 'text-emerald' : 'text-amber'}" style="font-weight:700;">
              ${isFullyCorrect ? '✓ INOCULATION EXCELLENCE — 100% RESOLVED' : isVulnCorrect || isBriefCorrect ? '⚡ PARTIAL INOCULATION — 50% RESOLVED' : '✗ INOCULATION FLAWED — 0% RESOLVED'}
            </span>
            <span class="badge ${isFullyCorrect ? 'badge-veracity' : 'badge-suspicion'}">
              ${isFullyCorrect ? '+25 COMPETENCY PTS' : '+10 COMPETENCY PTS'}
            </span>
          </div>
          <p class="body-text" style="font-size:0.85rem;color:var(--parchment-bright);margin-bottom:8px;line-height:1.5;">
            <strong>Targeted Vulnerability:</strong> ${esc(reframing.targetedVulnerability)}<br/>
            <strong>Optimal Countermeasure:</strong> ${esc(reframing.countermeasure)}
          </p>
          <div style="font-size:0.75rem;color:var(--stone-warm);display:flex;gap:12px;align-items:center;">
            <span>Logged to AttemptLog (<code>${CONTEXTS.SANDBOX}</code>)</span>
            ${!isFullyCorrect ? '<span style="color:var(--bronze-light);">Queued into SM-2 deck for spaced recall.</span>' : ''}
          </div>
        </div>
      `;
    }

    host.innerHTML = `
      <div class="card-header">
        <div>
          <h3 class="card-title">ADVERSARIAL SANDBOX // CHALLENGE MODE</h3>
          <div style="font-size:0.75rem;color:var(--stone-light);margin-top:2px;">Active Cognitive Inoculation Drill & Counter-Brief Formulation</div>
        </div>
        <span class="badge badge-suspicion">ACTIVE INFERENCE DRILL</span>
      </div>

      <p class="body-text" style="font-size:0.82rem;color:var(--stone-light);margin-bottom:var(--space-4);">
        Adversaries weaponize authentic telemetry by shifting psychological vectors. Select an adversarial vector below, identify the targeted cognitive vulnerability, and select the optimal inoculating counter-brief.
      </p>

      <!-- Vector Tabs -->
      <div style="display:flex;gap:8px;margin-bottom:var(--space-4);flex-wrap:wrap;">
        <button class="btn ${this._activeSandboxVector === 'outrageMaximizer' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-sandbox-outrage" data-vector="outrageMaximizer">
          🔥 01 // Outrage Maximizer
        </button>
        <button class="btn ${this._activeSandboxVector === 'falseConsensus' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-sandbox-consensus" data-vector="falseConsensus">
          👥 02 // False Consensus
        </button>
        <button class="btn ${this._activeSandboxVector === 'inGroupThreat' ? 'btn-primary' : 'btn-outline'} btn-sm" id="tab-sandbox-ingroup" data-vector="inGroupThreat">
          ⚔️ 03 // In-Group Threat
        </button>
      </div>

      <!-- Stimulus Box -->
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);border-left:3px solid var(--disinfo-crimson);padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span class="status-label text-crimson">WEAPONIZED ADVERSARIAL STIMULUS</span>
          <span class="badge badge-disinfo">${esc(reframing.badge)}</span>
        </div>
        <div style="font-size:0.92rem;font-weight:700;color:var(--parchment-bright);margin-bottom:6px;font-family:var(--font-display);">
          ${esc(reframing.headline)}
        </div>
        <p class="body-text" style="font-size:0.85rem;color:var(--stone-warm);line-height:1.5;margin:0;">
          ${esc(reframing.text)}
        </p>
      </div>

      <!-- Step 1: Vulnerability Drill -->
      <div style="margin-bottom:var(--space-4);">
        <label class="form-label" style="font-size:0.82rem;font-weight:700;color:var(--bronze-light);margin-bottom:8px;display:block;">
          Step 1: Identify Targeted Cognitive Vulnerability
        </label>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${vulnOptionsHtml}
        </div>
      </div>

      <!-- Step 2: Counter-Brief Selection -->
      <div style="margin-bottom:var(--space-4);">
        <label class="form-label" style="font-size:0.82rem;font-weight:700;color:var(--bronze-light);margin-bottom:8px;display:block;">
          Step 2: Formulate Inoculating Counter-Brief
        </label>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${briefOptionsHtml}
        </div>
      </div>

      <!-- Action Row -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-4);flex-wrap:wrap;gap:10px;">
        <span class="body-muted" style="font-size:0.74rem;">
          Tested Skills: ${reframing.skillIds.map(s => `<code style="color:var(--intel-cyan);">${esc(s)}</code>`).join(' ')}
        </span>
        <button class="btn btn-primary" id="btn-evaluate-adversarial-challenge" ${this._sandboxEvaluated ? 'disabled' : ''}>
          ⚡ Evaluate Inoculation Response
        </button>
      </div>

      ${feedbackCardHtml}
    `;

    // Bind Sandbox Tab Listeners
    ['outrageMaximizer', 'falseConsensus', 'inGroupThreat'].forEach(vec => {
      const btn = host.querySelector(`[data-vector="${vec}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          this._activeSandboxVector = vec;
          this._selectedVulnerabilityIndex = null;
          this._selectedBriefIndex = null;
          this._sandboxEvaluated = false;
          this._sandboxTimer = startTimer();
          this._renderSandboxContent();
        });
      }
    });

    // Bind Radio Listeners
    host.querySelectorAll('input[name="sandbox-vuln-option"]').forEach(input => {
      input.addEventListener('change', (e) => {
        this._selectedVulnerabilityIndex = parseInt(e.target.value, 10);
      });
    });

    host.querySelectorAll('input[name="sandbox-brief-option"]').forEach(input => {
      input.addEventListener('change', (e) => {
        this._selectedBriefIndex = parseInt(e.target.value, 10);
      });
    });

    // Bind Submit Evaluation Button
    const btnEval = document.getElementById('btn-evaluate-adversarial-challenge');
    if (btnEval) {
      btnEval.addEventListener('click', () => this._evaluateSandboxChallenge());
    }
  },

  _evaluateSandboxChallenge() {
    if (this._selectedVulnerabilityIndex === null || this._selectedBriefIndex === null) {
      this._app?.showToast({
        type: 'warning',
        title: 'INCOMPLETE INFERENCE',
        message: 'Please select both a targeted vulnerability and an inoculating counter-brief.'
      });
      return;
    }

    const reframing = this._adversarialReframings[this._activeSandboxVector];
    const isVulnCorrect = this._selectedVulnerabilityIndex === reframing.correctVulnerabilityIndex;
    const isBriefCorrect = this._selectedBriefIndex === reframing.correctBriefIndex;
    const isFullyCorrect = isVulnCorrect && isBriefCorrect;
    const latencyMs = this._sandboxTimer ? this._sandboxTimer() : null;

    // Record attempt to AttemptLog
    recordAttempt({
      skillIds: reframing.skillIds,
      itemId: `adversarial-${this._activeSandboxVector}`,
      correct: isFullyCorrect,
      context: CONTEXTS.SANDBOX,
      latencyMs
    });

    // If incorrect, dispatch SM-2 learning card for spaced repetition queue
    if (!isFullyCorrect) {
      window.dispatchEvent(new CustomEvent('aegis:sift-cards', {
        detail: {
          cards: [{
            id: `card-adv-${this._activeSandboxVector}-${Date.now()}`,
            prompt: `Adversarial Vector Inoculation: ${reframing.name}`,
            diagnosis: `Targeted Vulnerability: ${reframing.targetedVulnerability}`,
            mechanism: `Manipulative Reframing: ${reframing.text.slice(0, 100)}...`,
            countermeasure: reframing.countermeasure,
            tests: reframing.skillIds
          }]
        }
      }));
    }

    this._sandboxEvaluated = true;
    this._renderSandboxContent();

    this._app?.showToast({
      type: isFullyCorrect ? 'success' : 'warning',
      title: isFullyCorrect ? 'INOCULATION VERIFIED' : 'INOCULATION SUB-OPTIMAL',
      message: isFullyCorrect ? 'Both vulnerability and counter-brief accurately matched.' : 'Review diagnostic feedback and optimal countermeasures.'
    });
  }
};
