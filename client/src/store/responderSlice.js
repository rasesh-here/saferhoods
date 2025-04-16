import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    location: null,
    assignedIncidentId: null,
    route: null, 
    status: 'idle', // 'idle' | 'on_way' | 'on_scene' | 'returning'
    etaMinutes: null, 
};

const responderSlice = createSlice({
    name: 'responder',
    initialState,
    reducers: {
      
    },
});


export const selectResponderState = (state) => state.responder;

export default responderSlice.reducer;