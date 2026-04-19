import fs from 'node:fs';

const ids = [
  'cover',
  'login',
  '1',
  '2bday',
  '2u',
  '3',
  '5',
  '5pw',
  '6',
  '6study',
  '6year',
  '7',
  '8',
  'q-career',
  'q-career-other',
  'q-career-sub',
  'q-career-sub-other',
  'q-building-desc',
  'q-conntype',
  'q-startup-conntype',
  'q-project',
  'q-social',
  'q-friendship',
  'q-intellect',
  'q-romantic-sexuality',
  'q-romantic-status',
  'q-dating',
  'q-dating-appearance',
  'q-dating-personality',
  'q-dating-hobbies',
  'q-study-wish',
  'q-intellectual-ambition',
  'q-intellectual-venue',
  'q-hobby',
  'q-societies',
  'q-music',
  'q-friends',
  'confirm'
];

let code = fs.readFileSync('/Users/gdwha/SPCMVP/frontend/src/NewOnboarding.jsx', 'utf8');

let index = 0;
code = code.replace(/\{currentStep === '' && <StepWrapper key="" currentStep={currentStep} id="">\}/g, () => {
  const id = ids[index++];
  return `{currentStep === '${id}' && <StepWrapper key="${id}" currentStep={currentStep} id="${id}">}`;
});

fs.writeFileSync('/Users/gdwha/SPCMVP/frontend/src/NewOnboarding.jsx', code);
