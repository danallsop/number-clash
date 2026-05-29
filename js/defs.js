const COLS = 9, ROWS = 8;

const DEF = {
  'N13': { label: '13', value: 13 },
  'N12': { label: '12', value: 12 },
  'N11': { label: '11', value: 11 },
  'N10': { label: '10', value: 10 },
  'N9':  { label: '9',  value: 9  },
  'N8':  { label: '8',  value: 8  },
  'N7':  { label: '7',  value: 7  },
  'N6':  { label: '6',  value: 6  },
  'N5':  { label: '5',  value: 5  },
  'N4':  { label: '4',  value: 4  },
  'N3':  { label: '3',  value: 3  },
  'N2':  { label: '2',  value: 2  },
  'ONE': { label: '1',  value: 1  },
  'SPL': { label: '14', value: 14 },
  'FLG': { label: '0',  value: 0  }
};
const ARMY = 'N13,N12,N11,N10,N9,N8,N7,N6,N5,N4,N3,N2,ONE,ONE,ONE,ONE,ONE,ONE,SPL,SPL,FLG'.split(',');

function fisherYates(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
}
