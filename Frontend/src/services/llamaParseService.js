export const llamaParseService = {
    async parseFile(file) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            // Retrieve session token to establish identity
            const token = localStorage.getItem('auth_token');
            if (!token) throw new Error("Authentication required to upload files");

            // Upload to the Express Server
            const response = await fetch('/api/uploads/document', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            
            console.log("Locally saved at: ", data.localFilePath);

            // Returns the deeply parsed LlamaCloud string safely!
            return data.markdown;
            
        } catch (error) {
            console.error("Local Upload & Parse Service Error:", error);
            throw error;
        }
    }
};
