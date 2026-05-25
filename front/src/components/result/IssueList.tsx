import { issues } from '../../lib/constants'

export function IssueList() {
  return (
    <div className="issue-list">
      {issues.map(([level, text]) => (
        <span key={text}>
          <b>{level}</b>
          {text}
        </span>
      ))}
    </div>
  )
}
