import { createGame } from '@marrow/skeleton/web';
import { bat, stone } from '@marrow/skeleton/catalogue';
import { ACCESSIBILITY } from './accessibility.generated'; // built from accessibility-plan.md by the advisor

createGame({ title: 'Hello, Marrow', objects: [bat, stone], kit: ACCESSIBILITY.kit, assist: ACCESSIBILITY.assistByDefault });