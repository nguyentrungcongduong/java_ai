import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../auth/authApi';

const API_PATH = '/prompt-templates';

// Thunks
export const fetchTemplates = createAsyncThunk('prompts/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const response = await apiClient.get(API_PATH, { params });
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Không thể tải danh sách template');
  }
});

export const createTemplate = createAsyncThunk('prompts/create', async (data, { rejectWithValue }) => {
  try {
    const response = await apiClient.post(API_PATH, data);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Tạo mới thất bại');
  }
});

export const updateTemplate = createAsyncThunk('prompts/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    const response = await apiClient.put(`${API_PATH}/${id}`, data);
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Cập nhật thất bại');
  }
});

export const approveTemplate = createAsyncThunk('prompts/approve', async ({ id, status }, { rejectWithValue }) => {
  try {
    const response = await apiClient.put(`${API_PATH}/${id}/approve`, { status });
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Duyệt template thất bại');
  }
});

export const deleteTemplate = createAsyncThunk('prompts/delete', async (id, { rejectWithValue }) => {
  try {
    await apiClient.delete(`${API_PATH}/${id}`);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Xóa thất bại');
  }
});

const promptTemplateSlice = createSlice({
  name: 'promptTemplates',
  initialState: {
    templates: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearPromptError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading = false;
        state.templates = action.payload;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.templates.unshift(action.payload);
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const index = state.templates.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.templates[index] = action.payload;
        }
      })
      .addCase(approveTemplate.fulfilled, (state, action) => {
        const index = state.templates.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.templates[index] = action.payload;
        }
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter((t) => t.id !== action.payload);
      });
  },
});

export const { clearPromptError } = promptTemplateSlice.actions;
export default promptTemplateSlice.reducer;
