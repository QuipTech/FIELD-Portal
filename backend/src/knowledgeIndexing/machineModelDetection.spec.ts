import { detectMachineModels } from './machineModelDetection';

const models = [
  { id: 'cat-793f', manufacturer: 'CAT', name: '793F' },
  { id: 'sandvik-dr410', manufacturer: 'Sandvik', name: 'DR410' },
  { id: 'titan', manufacturer: 'Acme', name: 'Titan' },
];

describe('detectMachineModels', () => {
  it('finds models by manufacturer + name or by a model number alone', () => {
    const text =
      'CAT 793F charge pressure… the 793F rear struts. Also fits the Sandvik DR410.';
    expect(detectMachineModels(text, models)).toEqual([
      { modelId: 'cat-793f', mentions: 2 },
      { modelId: 'sandvik-dr410', mentions: 1 },
    ]);
  });

  it('only matches a word-only model name together with its manufacturer', () => {
    expect(detectMachineModels('A titan of the industry.', models)).toEqual([]);
    expect(
      detectMachineModels('Service the Acme Titan monthly.', models),
    ).toEqual([{ modelId: 'titan', mentions: 1 }]);
  });
});
