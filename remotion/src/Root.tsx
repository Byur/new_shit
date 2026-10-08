import "./index.css";
import { Composition } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { Logo } from "./HelloWorld/Logo";
import {
  RemotionCoreSkillsV2Video,
  remotionCoreSkillsV2DurationInFrames,
} from "./RemotionCoreSkillsV2Video";
import { SkillConceptV2Video, skillConceptV2DurationInFrames } from "./SkillConceptV2Video";
import { AgentAndSkillV2Video, agentAndSkillV2DurationInFrames } from "./AgentAndSkillV2Video";
import {
  StockJargonSystemVideo,
  stockJargonSystemDurationInFrames,
} from "./StockJargonSystemVideo";
import {
  InternetRemakesIndustryVideo,
  internetRemakesIndustryDurationInFrames,
} from "./InternetRemakesIndustryVideo";
import {
  WizzSkillKeeperStoryVideo,
  wizzSkillKeeperStoryDurationInFrames,
} from "./WizzSkillKeeperStoryVideo";
import {
  WizzSafekeeperArchitectureVideo,
  wizzSafekeeperArchitectureDurationInFrames,
} from "./WizzSafekeeperArchitectureVideo";
import {
  DeepSeekHarnessPluginsVideo,
  deepSeekHarnessPluginsDurationInFrames,
} from "./DeepSeekHarnessPluginsVideo";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DeepSeekHarnessPlugins"
        component={DeepSeekHarnessPluginsVideo}
        durationInFrames={deepSeekHarnessPluginsDurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="WizzSkillKeeperStory"
        component={WizzSkillKeeperStoryVideo}
        durationInFrames={wizzSkillKeeperStoryDurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="WizzSafekeeperArchitecture"
        component={WizzSafekeeperArchitectureVideo}
        durationInFrames={wizzSafekeeperArchitectureDurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="StockJargonSystem"
        component={StockJargonSystemVideo}
        durationInFrames={stockJargonSystemDurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="InternetRemakesIndustry"
        component={InternetRemakesIndustryVideo}
        durationInFrames={internetRemakesIndustryDurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="RemotionCoreSkills"
        component={RemotionCoreSkillsV2Video}
        durationInFrames={remotionCoreSkillsV2DurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="SkillConcepts"
        component={SkillConceptV2Video}
        durationInFrames={skillConceptV2DurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="AgentAndSkill"
        component={AgentAndSkillV2Video}
        durationInFrames={agentAndSkillV2DurationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        // You can take the "id" to render a video:
        // npx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      {/* Mount any React component to make it show up in the sidebar and work on it individually! */}
      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          logoColor1: "#91dAE2",
          logoColor2: "#86A8E7",
        }}
      />
    </>
  );
};
