export default function Logo({ size = 40 }) {
  return (
    <img
      src="/logo.png"
      alt="Social Analytics"
      style={{ width: size, height: size, flexShrink: 0, objectFit: 'contain', borderRadius: 6 }}
    />
  );
}
