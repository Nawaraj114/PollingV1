import Image from "next/image";

const colors = ["#1473e6", "#e56b4a", "#625cb5", "#26856d", "#ba6c29"];

function colorForName(name: string) {
  const value = Array.from(name).reduce(
    (total, character) => total + character.codePointAt(0)!,
    0,
  );

  return colors[value % colors.length];
}

export function MemberAvatar({
  avatarUrl,
  className = "h-10 w-10",
  name,
}: {
  avatarUrl?: string | null;
  className?: string;
  name: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full text-[0.68rem] font-bold text-white ${className}`}
      style={avatarUrl ? undefined : { backgroundColor: colorForName(name) }}
      title={name}
    >
      {avatarUrl ? (
        <Image
          alt={`${name}'s avatar`}
          className="object-cover"
          fill
          sizes="80px"
          src={avatarUrl}
          unoptimized
        />
      ) : (
        initials || "FC"
      )}
    </span>
  );
}
