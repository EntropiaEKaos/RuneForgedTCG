import Image from "next/image";

interface CollectionSymbolMarkProps {
  symbol?: string | null;
  name?: string;
  className?: string;
}

export default function CollectionSymbolMark({ symbol, name = "coleção", className = "" }: CollectionSymbolMarkProps) {
  if (symbol?.startsWith("/")) {
    return <Image src={symbol} alt={`Símbolo da ${name}`} width={64} height={64} unoptimized className={className || "h-4 w-4 rounded-full object-cover"} />;
  }
  return <span className={className}>{symbol || "◆"}</span>;
}
