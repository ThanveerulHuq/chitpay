import React from "react";
import { Composition } from "remotion";
import { ChitPayVideo, DURATION_FRAMES } from "./ChitPayVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ChitPayEN"
        component={() => <ChitPayVideo lang="en" />}
        durationInFrames={DURATION_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ChitPayTA"
        component={() => <ChitPayVideo lang="ta" />}
        durationInFrames={DURATION_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
