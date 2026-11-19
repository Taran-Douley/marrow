// Made by the Marrow advisor from Hello, Marrow's accessibility plan. Do not edit: change the plan and build again.
import type { KitConfig, ProfilePatch } from '@marrow/skeleton';

/** Pass to createKit or createGame: { ...ACCESSIBILITY.kit, ...yourOwnSettings }. */
export const ACCESSIBILITY: { kit: KitConfig; profile: ProfilePatch; assistByDefault: boolean } = {
  "kit": {
    "voices": [
      {
        "label": "a low church bell",
        "hz": 294,
        "wave": "triangle"
      },
      {
        "label": "a thin glass chime",
        "hz": 587,
        "wave": "sine"
      }
    ],
    "audio": {
      "recipes": {
        "jumped": {
          "hz": 0,
          "wave": "sine",
          "gain": 0.3,
          "shape": {
            "noise": true,
            "filterHz": 700,
            "filterTo": 220,
            "seconds": 0.1
          }
        },
        "landed": {
          "hz": 0,
          "wave": "sine",
          "gain": 0.3,
          "shape": {
            "noise": true,
            "filterHz": 700,
            "filterTo": 220,
            "seconds": 0.1
          }
        },
        "fall": {
          "hz": 120,
          "wave": "triangle",
          "gain": 0.7,
          "shape": {
            "hzTo": 55,
            "seconds": 0.4
          }
        }
      }
    },
    "coach": true,
    "events": {
      "palette-reward": {
        "caption": "Reward",
        "sound": {
          "hz": 880,
          "wave": "sine",
          "gain": 0.7,
          "shape": {
            "hzTo": 1320,
            "seconds": 0.5
          },
          "role": "reward"
        },
        "haptic": [
          40,
          30,
          80
        ]
      },
      "palette-danger": {
        "caption": "Danger",
        "sound": {
          "hz": 165,
          "wave": "triangle",
          "gain": 0.55,
          "shape": {
            "hzTo": 220,
            "filterHz": 1100,
            "wobbleHz": 5,
            "wobble": 0.07,
            "seconds": 1.4
          },
          "role": "effect"
        },
        "haptic": [
          100,
          40,
          100
        ],
        "priority": "critical"
      },
      "palette-tick": {
        "decorative": true,
        "sound": {
          "hz": 660,
          "wave": "sine",
          "gain": 0.3,
          "shape": {
            "seconds": 0.05
          },
          "role": "effect"
        }
      }
    }
  },
  "profile": {},
  "assistByDefault": false
};

/** What was built, and what your code still has to do. */
export const BUILT = [
  "Sounds from the haunted palette: objects without a sound of their own count down with a low church bell and a thin glass chime; jumps and landings are a creaking board; a fall is a hollow thud.",
  "The coach is offered in the settings (off until a player picks a lead).",
  "Timing help is offered in the menu. Its note can ask for it on by default: write \"on by default\" in the note."
];
export const TODO = [];
