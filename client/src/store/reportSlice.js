import { createSelector, createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
    reports: []
};

const reportSlice = createSlice({
    name: 'reports',
    initialState,
    reducers: {
        addReport: {
            reducer(state, action) {
                state.reports.push(action.payload);
            },
            prepare(reportData) {
                return {
                    payload: {
                        id: nanoid(),
                        status: 'New',
                        severity: 'Medium',
                        assignedTeam: null,
                        declineReason: null,
                        ...reportData,
                         timestamp: reportData.timestamp || new Date().toISOString(),
                    },
                };
            },
        },
         updateReportStatus(state, action) {
            const { id, status, assignedTeam, declineReason } = action.payload;
            const existingReport = state.reports.find(report => report.id === id);
            if (existingReport) {
                existingReport.status = status;
                if (assignedTeam !== undefined) existingReport.assignedTeam = assignedTeam;
                if (declineReason !== undefined) existingReport.declineReason = declineReason;
                if (status === 'Declined' && !declineReason) {
                     existingReport.declineReason = 'No reason provided.';
                }
                 if (status !== 'Declined') {
                    existingReport.declineReason = null;
                }
                 if (status !== 'Responding') {
                }
            }
        },

    },
});

export const { addReport, updateReportStatus } = reportSlice.actions;


export const selectAllReports = (state) => state.reports.reports;
export const selectReportById = (state, reportId) =>
    state.reports.reports.find((report) => report.id === reportId);
export const selectNewReportsCount = createSelector(
    [selectAllReports],
    (reports) => reports.filter(report => report.status === 'New').length
);


export const selectActiveHighSeverityCount = createSelector(
    [selectAllReports],
    (reports) => reports.filter(report =>
        report.severity === 'High' &&
        report.status !== 'Resolved' &&
        report.status !== 'Declined'
    ).length
);

export default reportSlice.reducer;