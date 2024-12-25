import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.cluster import KMeans as SklearnKMeans
from sklearn.metrics import silhouette_score, homogeneity_score, completeness_score, v_measure_score
from pre_traitement.clean import detect_target_column

def encode_data(data):
    encoded_data = data.copy()
    label_encoder = LabelEncoder()
    scaler = StandardScaler()
    
    for column in data.columns:
        if data[column].dtype == 'object' or isinstance(data[column].dtype, pd.StringDtype):
            try:
                encoded_data[column] = label_encoder.fit_transform(data[column].astype(str))
            except Exception as e:
                print(f"Error encoding column {column}: {str(e)}")
                encoded_data[column] = 0
        else:
            try:
                encoded_data[column] = scaler.fit_transform(data[column].values.reshape(-1, 1))
            except Exception as e:
                print(f"Error scaling column {column}: {str(e)}")
                encoded_data[column] = data[column]
            
    return encoded_data

def KMeans(data):
    try:
        print("Input data shape:", data.shape)
        
        # Encode data
        encoded_data = encode_data(data)
        X, y, target_column, problem_type = preprocess_data(encoded_data)
        
        if X.empty:
            raise ValueError("Empty dataset after preprocessing")
            
        kmeans = SklearnKMeans(n_clusters=3, random_state=42)
        clusters = kmeans.fit_predict(X)
        
        metrics = {
            'silhouette': float(silhouette_score(X, clusters)),
            'homogeneity': float(homogeneity_score(y, clusters)) if y is not None else 0,
            'completeness': float(completeness_score(y, clusters)) if y is not None else 0,
            'v_measure': float(v_measure_score(y, clusters)) if y is not None else 0
        }
        
        print("\nClustering Metrics:")
        for key, value in metrics.items():
            print(f"{key.title()}: {value:.4f}")
            
        return kmeans, metrics
        
    except Exception as e:
        print(f"Error in KMeans clustering: {str(e)}")
        return None, {'silhouette': 0, 'homogeneity': 0, 'completeness': 0, 'v_measure': 0}
        
    except Exception as e:
        print(f"Error in KMeans clustering: {str(e)}")
        return None, get_default_metrics()

def calculate_metrics(X, y, clusters):
    """Calculate clustering metrics"""
    try:
        return {
            'silhouette': float(silhouette_score(X, clusters)),
            'homogeneity': float(homogeneity_score(y, clusters)) if y is not None else 0,
            'completeness': float(completeness_score(y, clusters)) if y is not None else 0,
            'v_measure': float(v_measure_score(y, clusters)) if y is not None else 0
        }
    except Exception as e:
        print(f"Error calculating metrics: {str(e)}")
        return get_default_metrics()

def get_default_metrics():
    """Return default metrics when calculation fails"""
    return {
        'silhouette': 0,
        'homogeneity': 0,
        'completeness': 0,
        'v_measure': 0
    }

def print_metrics(metrics):
    """Print formatted metrics"""
    print("\nClustering Metrics:")
    for metric, value in metrics.items():
        print(f"{metric.title()}: {value:.4f}")

def preprocess_data(data):
    """Preprocess data for clustering"""
    target_column, problem_type = detect_target_column(data)
    
    if target_column:
        X = data.drop(columns=[target_column])
        y = data[target_column]
    else:
        X = data
        y = None

    return X, y, target_column, problem_type