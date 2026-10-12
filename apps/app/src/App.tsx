import { Suspense, lazy } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { Route, Switch } from 'wouter';
import Home from './screens/Home';
import { Placeholder } from './screens/Placeholder';
import { useT } from './i18n/useT';

const RoomRoute = lazy(() => import('./screens/RoomRoute'));
const History = lazy(() => import('./screens/History'));
const Learn = lazy(() => import('./screens/Learn'));
const loadFeatures = () => import('./game/motionFeatures').then(m => m.default);

export function App() {
  const t = useT();
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Suspense fallback={<Placeholder title="Tysiąc" text={t('common.loading')} />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/r/:code">{params => <RoomRoute code={params.code} />}</Route>
            <Route path="/learn" component={Learn} />
            <Route path="/history" component={History} />
            <Route>
              <Placeholder title={t('screens.notFound')} text={t('screens.notFoundText')} back />
            </Route>
          </Switch>
        </Suspense>
      </MotionConfig>
    </LazyMotion>
  );
}
