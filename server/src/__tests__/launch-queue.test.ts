import { describe, expect, it } from 'vitest';
import { flightStillToFly, onDeckSlots } from '@aero-judge/utils';

describe('flightStillToFly', () => {
  it('keeps a pilot who has not scored', () => {
    expect(flightStillToFly({ status: 'PENDING' })).toBe(true);
    expect(flightStillToFly({ status: 'LAUNCHED' })).toBe(true);
    expect(
      flightStillToFly({
        status: 'PENDING',
        score: { status: 'DRAFT', resultType: 'MEASURED', finalScoreCm: null },
      }),
    ).toBe(true);
  });

  it('drops a pilot who already has a recorded score', () => {
    expect(flightStillToFly({ status: 'SCORED' })).toBe(false);
    expect(
      flightStillToFly({
        status: 'PENDING',
        score: { status: 'ENTERED', resultType: 'MEASURED', finalScoreCm: 16 },
      }),
    ).toBe(false);
  });

  it('keeps a reflight in the queue', () => {
    expect(
      flightStillToFly({
        status: 'REFLIGHT',
        score: { status: 'ENTERED', resultType: 'REFLIGHT', finalScoreCm: 200 },
      }),
    ).toBe(true);
  });
});

describe('onDeckSlots', () => {
  it('skips pilots who already scored and advances past the last score', () => {
    const flights = [
      { pilotId: 'mohar', name: 'Mohar', stillToFly: false },
      { pilotId: 'aman', name: 'Aman', stillToFly: false },
      { pilotId: 'yog', name: 'Yog Raj', stillToFly: false },
      { pilotId: 'pankaj', name: 'Pankaj', stillToFly: false },
      { pilotId: 'saurabh', name: 'Saurabh', stillToFly: true },
      { pilotId: 'dushyant', name: 'Dushyant', stillToFly: true },
      { pilotId: 'puran', name: 'Puran', stillToFly: true },
    ];

    const deck = onDeckSlots(flights, 'aman');

    expect(deck.nowFlying?.name).toBe('Saurabh');
    expect(deck.queue.map((pilot) => pilot.name)).toEqual(['Dushyant', 'Puran']);
  });

  it('keeps the selected pilot as now flying when they have not scored', () => {
    const flights = [
      { pilotId: 'yog', name: 'Yog Raj', stillToFly: false },
      { pilotId: 'saurabh', name: 'Saurabh', stillToFly: true },
      { pilotId: 'dushyant', name: 'Dushyant', stillToFly: true },
    ];

    const deck = onDeckSlots(flights, 'saurabh');

    expect(deck.nowFlying?.name).toBe('Saurabh');
    expect(deck.queue.map((pilot) => pilot.name)).toEqual(['Dushyant']);
  });

  it('includes an earlier pilot who was skipped, after the ones still ahead', () => {
    const flights = [
      { pilotId: 'skipped', name: 'Skipped', stillToFly: true },
      { pilotId: 'aman', name: 'Aman', stillToFly: false },
      { pilotId: 'next', name: 'Next', stillToFly: true },
    ];

    const deck = onDeckSlots(flights, 'aman');

    expect(deck.nowFlying?.name).toBe('Next');
    expect(deck.queue.map((pilot) => pilot.name)).toEqual(['Skipped']);
  });
});
