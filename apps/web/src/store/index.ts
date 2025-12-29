import { create } from 'zustand'

const useStore = create((set) => ({
    userInfo: {},
    setUserInfo: (userInfo: any) => set({ userInfo })
}))

export default useStore