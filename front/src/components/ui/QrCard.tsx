import { CheckCircle2 } from 'lucide-react'
import can1 from '../../assets/can1.jpg'
import can2 from '../../assets/can2.jpg'

const supportImages = {
  can1,
  can2,
}

export function QrCard({ image = 'can1', title }: { image?: keyof typeof supportImages; title: string }) {
  return (
    <article className="qr-card">
      <CheckCircle2 size={22} />
      <h3>{title}</h3>
      <div className="qr-placeholder qr-placeholder--image" aria-label={`${title}占位图`}>
        <img src={supportImages[image]} alt={title} loading="lazy" />
      </div>
      <p>感谢支持</p>
    </article>
  )
}
