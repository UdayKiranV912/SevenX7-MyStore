
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tvywzlolrjukfkukxjpr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2eXd6bG9scmp1a2ZrdWt4anByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzU5MjAsImV4cCI6MjA4MDk1MTkyMH0.bKJ_GeeRY4tTmuJ9vO1j_nj5ZuKP78sL4TFtZaUvYpI';

export const supabase = createClient(supabaseUrl, supabaseKey);
