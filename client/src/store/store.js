import { configureStore } from '@reduxjs/toolkit';
import reportsReducer from './reportSlice';
import responderReducer from './responderSlice';
import { reportApi } from '../api/reportApi';

export const store = configureStore({
  reducer: {
    reports: reportsReducer,
    responder: responderReducer,
    [reportApi.reducerPath]: reportApi.reducer,
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware().concat(reportApi.middleware),
});

export default store;