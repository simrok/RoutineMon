import { io, Socket } from 'socket.io-client'
import { SERVER_BASE } from './config'

let socket: Socket | null = null

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SERVER_BASE)
  }
  return socket
}

export const joinRoom = (roomCode: string, playerId: number) => {
  getSocket().emit('join-room', { roomCode, playerId })
}

export const leaveRoom = (roomCode: string, playerId: number) => {
  getSocket().emit('leave-room', { roomCode, playerId })
}