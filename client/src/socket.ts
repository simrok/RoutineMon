import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io('http://localhost:4000')
  }
  return socket
}

export const joinRoom = (roomCode: string, playerId: number) => {
  getSocket().emit('join-room', { roomCode, playerId })
}

export const leaveRoom = (roomCode: string, playerId: number) => {
  getSocket().emit('leave-room', { roomCode, playerId })
}