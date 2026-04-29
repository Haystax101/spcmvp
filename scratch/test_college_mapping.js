const OXFORD_COLLEGES = ['All Souls', 'Balliol', 'Brasenose', 'Christ Church', 'Corpus Christi', 'Exeter', 'Green Templeton', 'Harris Manchester', 'Hertford', 'Jesus', 'Keble', 'Kellogg', 'Lady Margaret Hall', 'Linacre', 'Lincoln', 'Magdalen', 'Mansfield', 'Merton', 'New College', 'Nuffield', 'Oriel', 'Pembroke', "Queen's", 'Reuben', "Regent's Park", 'Somerville', "St Anne's", "St Antony's", "St Catherine's", 'St Cross', 'St Edmund Hall', "St Hilda's", "St Hugh's", "St John's", "St Peter's", 'Trinity', 'University', 'Wadham', 'Wolfson', 'Worcester', 'Wycliffe Hall'];

const COLLEGE_MAP = {
  'all-souls': 'All Souls',
  'balliol': 'Balliol',
  'bnc': 'Brasenose',
  'chch': 'Christ Church',
  'ccc': 'Corpus Christi',
  'exeter': 'Exeter',
  'gtc': 'Green Templeton',
  'hmc': 'Harris Manchester',
  'hertford': 'Hertford',
  'jesus': 'Jesus',
  'keble': 'Keble',
  'kellogg': 'Kellogg',
  'lmh': 'Lady Margaret Hall',
  'linacre': 'Linacre',
  'lincoln': 'Lincoln',
  'magd': 'Magdalen',
  'mansfield': 'Mansfield',
  'merton': 'Merton',
  'new': 'New College',
  'nuffield': 'Nuffield',
  'oriel': 'Oriel',
  'pmb': 'Pembroke',
  'queens': "Queen's",
  'regents': "Regent's Park",
  'reuben': 'Reuben',
  'st-annes': "St Anne's",
  'sant': "St Antony's",
  'stcatz': "St Catherine's",
  'stx': 'St Cross',
  'seh': 'St Edmund Hall',
  'st-hildas': "St Hilda's",
  'st-hughs': "St Hugh's",
  'sjc': "St John's",
  'spc': "St Peter's",
  'somerville': 'Somerville',
  'trinity': 'Trinity',
  'univ': 'University',
  'wadham': 'Wadham',
  'wolfson': 'Wolfson',
  'worc': 'Worcester',
  'wycliffe': 'Wycliffe Hall'
};

const deriveCollegeFromEmail = (value) => {
  const domain = value.split('@')[1] || '';
  const collegeDomain = domain.replace(/\.ox\.ac\.uk$/i, '').trim().toLowerCase();
  if (!collegeDomain) return '';

  const abbreviation = collegeDomain.split('.')[0];
  if (COLLEGE_MAP[abbreviation]) {
    return COLLEGE_MAP[abbreviation];
  }

  const normalize = (input) => input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = normalize(abbreviation);
  const match = OXFORD_COLLEGES.find((college) => normalize(college) === target);
  if (match) return match;

  const fallback = abbreviation
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
  return fallback;
};

const tests = [
  { email: 'user@bnc.ox.ac.uk', expected: 'Brasenose' },
  { email: 'user@chch.ox.ac.uk', expected: 'Christ Church' },
  { email: 'user@pmb.ox.ac.uk', expected: 'Pembroke' },
  { email: 'user@univ.ox.ac.uk', expected: 'University' },
  { email: 'user@stcatz.ox.ac.uk', expected: "St Catherine's" },
  { email: 'user@new.ox.ac.uk', expected: 'New College' },
  { email: 'user@magd.ox.ac.uk', expected: 'Magdalen' },
  { email: 'user@seh.ox.ac.uk', expected: 'St Edmund Hall' },
  { email: 'user@hertford.ox.ac.uk', expected: 'Hertford' },
  { email: 'user@unknown.ox.ac.uk', expected: 'Unknown' },
  { email: 'user@department.ox.ac.uk', expected: 'Department' },
];

tests.forEach(t => {
  const actual = deriveCollegeFromEmail(t.email);
  console.log(`Email: ${t.email.padEnd(25)} | Expected: ${t.expected.padEnd(15)} | Actual: ${actual.padEnd(15)} | ${actual === t.expected ? '✅' : '❌'}`);
});
