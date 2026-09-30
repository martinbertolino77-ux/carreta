export default function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-[42px] h-6 rounded-full relative transition-colors flex-shrink-0
        ${value ? 'bg-azul-600' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full transition-all
        ${value ? 'left-[21px]' : 'left-[3px]'}`}
      />
    </button>
  )
}
