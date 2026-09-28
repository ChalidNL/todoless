export const BlindSpots = ({ name }: { name: string }) => (
  <div>
    <p>Zichtbaarheid</p>
    <span>TAKEN</span>
    <button aria-label={`Edit ${name}`}>Edit</button>
    <span>{'FOCUS'}</span>
  </div>
);

export const options = [
  { key: 'blocked', label: 'Geblokkeerd' },
];