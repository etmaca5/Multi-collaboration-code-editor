
const adjectives = [
  'clever', 'bright', 'swift', 'calm', 'bold', 'gentle', 'happy', 'keen',
  'witty', 'brave', 'quick', 'smart', 'cool', 'neat', 'sharp', 'wise'
]

const animals = [
  'fox', 'wolf', 'bear', 'lion', 'tiger', 'eagle', 'hawk', 'owl',
  'deer', 'rabbit', 'cat', 'dog', 'bird', 'fish', 'bee', 'ant'
]

export function generateUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  const number = Math.floor(Math.random() * 1000)
  
  return `${adjective}-${animal}-${number}`
}

export function getUsername(): string {
  const stored = localStorage.getItem('collab-username')
  if (stored) {
    return stored
  }
  
  const username = generateUsername()
  localStorage.setItem('collab-username', username)
  return username
}

export function setUsername(username: string): void {
  localStorage.setItem('collab-username', username)
}
