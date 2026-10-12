import { Suspense, lazy } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { Route, Switch } from 'wouter';
import Home from './screens/Home';
import { Placeholder } from './screens/Placeholder';

const RoomRoute = lazy(() => import('./screens/RoomRoute'));
const Learn = lazy(() => import('./screens/Learn'));
const loadFeatures = () => import('./game/motionFeatures').then(m => m.default);

export function App() {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Suspense fallback={<Placeholder title="Tysiąc" text="Loading…" />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/r/:code">{params => <RoomRoute code={params.code} />}</Route>
            <Route path="/learn" component={Learn} />
            <Route path="/history">
              <Placeholder title="History" text="Your finished games will show up here soon." back />
            </Route>
            <Route>
              <Placeholder title="Not found" text="That page does not exist." back />
            </Route>
          </Switch>
        </Suspense>
      </MotionConfig>
    </LazyMotion>
  );
}
