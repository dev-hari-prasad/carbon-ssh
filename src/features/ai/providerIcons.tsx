import { AmazonWebServicesDark, AnthropicDark, OpenAIDark, OpenRouterDark, VercelDark } from "@ridemountainpig/svgl-react";
import { Plugs } from "@phosphor-icons/react";
import type { AIProviderId } from "@/lib/ai";

type IconProps = { size?: number; className?: string };

export function ProviderIcon({ id, size = 14, className = "" }: IconProps & { id: AIProviderId }) {
  const style = { width: size, height: size };
  switch (id) {
    case "openai":
      return <OpenAIDark style={style} className={className} />;
    case "anthropic":
      return <AnthropicDark style={style} className={className} />;
    case "gateway":
      return <VercelDark style={style} className={className} />;
    case "openrouter":
      return <OpenRouterDark style={style} className={className} />;
    case "bedrock":
      return <AmazonWebServicesDark style={style} className={className} />;
    case "custom":
      return <Plugs size={size} className={className} weight="bold" />;
  }
}
